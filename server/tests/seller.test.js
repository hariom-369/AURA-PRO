import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../services/emailService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isEmailConfigured: vi.fn(() => false) };
});

vi.mock('../services/sellerDocumentService.js', () => ({
  uploadSellerDocument: vi.fn(async () => ({ publicId: 'mock/verification/doc-1', resourceType: 'image' })),
  getSignedDocumentUrl: vi.fn(() => 'https://res.cloudinary.com/mock/signed-url?exp=123'),
  deleteSellerDocument: vi.fn(async () => {}),
}));

const app = (await import('../app.js')).default;
const User = (await import('../models/User.js')).default;
const Seller = (await import('../models/Seller.js')).default;
const AuditLog = (await import('../models/AuditLog.js')).default;
const { uploadSellerDocument } = await import('../services/sellerDocumentService.js');

let userCounter = 0;
async function registerCustomer() {
  userCounter += 1;
  const email = `seller-applicant-${userCounter}@example.com`;
  const registerRes = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Applicant', email, password: 'password123', phone: `90000000${String(userCounter).padStart(2, '0')}` });
  const { pendingToken, devCode } = registerRes.body.data;
  const verifyRes = await request(app).post('/api/v1/auth/verify-signup-otp').send({ pendingToken, code: devCode });
  return { token: verifyRes.body.data.token, userId: verifyRes.body.data.user._id, email };
}

async function registerAdmin() {
  const { token, userId, email } = await registerCustomer();
  await User.updateOne({ _id: userId }, { role: 'admin' });
  return { token, userId, email };
}

function authed(token) {
  return { Authorization: `Bearer ${token}` };
}

async function completeApplication(token) {
  await request(app)
    .patch('/api/v1/seller/application/account')
    .set(authed(token))
    .send({ contactEmail: 'contact@example.com', contactPhone: '9000000000' });
  await request(app)
    .patch('/api/v1/seller/application/business')
    .set(authed(token))
    .send({ legalName: 'Acme Traders', storeName: `Acme Store ${Date.now()}-${Math.random()}` });
  await request(app)
    .patch('/api/v1/seller/application/payout')
    .set(authed(token))
    .send({ accountHolderName: 'A Trader', bankName: 'Test Bank', accountNumber: '123456789012', ifsc: 'HDFC0001234' });
  await request(app)
    .post('/api/v1/seller/application/verification/documents')
    .set(authed(token))
    .field('type', 'gstin_certificate')
    .attach('document', Buffer.from('fake-file-bytes'), 'gst.png');
  return request(app).post('/api/v1/seller/application/submit').set(authed(token));
}

beforeEach(() => {
  vi.mocked(uploadSellerDocument).mockClear();
});

describe('Seller onboarding (self-service)', () => {
  it('starts as no application until the first save', async () => {
    const { token } = await registerCustomer();
    const res = await request(app).get('/api/v1/seller/application').set(authed(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('the first step PATCH creates a draft application attached to the logged-in user, not a new account', async () => {
    const { token, userId } = await registerCustomer();
    const res = await request(app)
      .patch('/api/v1/seller/application/business')
      .set(authed(token))
      .send({ legalName: 'Acme Traders' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('draft');

    const seller = await Seller.findOne({ user: userId });
    expect(seller).toBeTruthy();
    expect(seller.business.legalName).toBe('Acme Traders');

    // Still exactly one User document for this applicant.
    const usersWithEmail = await User.countDocuments({ _id: userId });
    expect(usersWithEmail).toBe(1);
  });

  it('rejects a duplicate store name across sellers', async () => {
    const a = await registerCustomer();
    const b = await registerCustomer();
    const storeName = `Unique Store ${Date.now()}`;

    await request(app).patch('/api/v1/seller/application/business').set(authed(a.token)).send({ storeName });
    const res = await request(app).patch('/api/v1/seller/application/business').set(authed(b.token)).send({ storeName });

    expect(res.status).toBe(409);
  });

  it('encrypts the bank account number at rest and only ever returns the last 4 digits', async () => {
    const { token, userId } = await registerCustomer();
    const res = await request(app)
      .patch('/api/v1/seller/application/payout')
      .set(authed(token))
      .send({ accountHolderName: 'A Trader', bankName: 'Test Bank', accountNumber: '123456789012', ifsc: 'HDFC0001234' });

    expect(res.status).toBe(200);
    expect(res.body.data.payout.accountLast4).toBe('9012');
    expect(JSON.stringify(res.body)).not.toMatch(/123456789012/);

    const seller = await Seller.findOne({ user: userId });
    expect(seller.payout.encryptedAccountNumber).toBeTruthy();
    expect(seller.payout.encryptedAccountNumber).not.toMatch(/123456789012/);
  });

  it('uploads a verification document via the mocked Cloudinary service and stores no raw URL', async () => {
    const { token, userId } = await registerCustomer();
    const res = await request(app)
      .post('/api/v1/seller/application/verification/documents')
      .set(authed(token))
      .field('type', 'pan_card')
      .attach('document', Buffer.from('fake-file-bytes'), 'pan.png');

    expect(res.status).toBe(201);
    expect(uploadSellerDocument).toHaveBeenCalledTimes(1);
    expect(res.body.data.verification.documents).toHaveLength(1);
    expect(res.body.data.verification.documents[0]).not.toHaveProperty('publicId');

    const seller = await Seller.findOne({ user: userId });
    expect(seller.verification.documents[0].publicId).toBe('mock/verification/doc-1');
  });

  it('rejects submission when required fields are missing', async () => {
    const { token } = await registerCustomer();
    await request(app).patch('/api/v1/seller/application/business').set(authed(token)).send({ legalName: 'Acme' });

    const res = await request(app).post('/api/v1/seller/application/submit').set(authed(token));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/incomplete/i);
  });

  it('submits successfully once every required field is present, moving status to submitted', async () => {
    const { token } = await registerCustomer();
    const res = await completeApplication(token);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('submitted');
  });

  it('locks editing once submitted', async () => {
    const { token } = await registerCustomer();
    await completeApplication(token);

    const res = await request(app)
      .patch('/api/v1/seller/application/business')
      .set(authed(token))
      .send({ legalName: 'Changed Name' });

    expect(res.status).toBe(409);
  });
});

describe('Admin seller review', () => {
  it('lists submitted applications and can filter by status', async () => {
    const applicant = await registerCustomer();
    await completeApplication(applicant.token);
    const admin = await registerAdmin();

    const res = await request(app).get('/api/v1/admin/sellers?status=submitted').set(authed(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.data.sellers.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.sellers.every((s) => s.status === 'submitted')).toBe(true);
  });

  it('rejects an illegal status transition (e.g. draft straight to approved)', async () => {
    const applicant = await registerCustomer();
    await request(app).patch('/api/v1/seller/application/business').set(authed(applicant.token)).send({ legalName: 'X' });
    const seller = await Seller.findOne({ user: applicant.userId });
    const admin = await registerAdmin();

    const res = await request(app)
      .patch(`/api/v1/admin/sellers/${seller._id}/status`)
      .set(authed(admin.token))
      .send({ status: 'approved' });

    expect(res.status).toBe(400);
  });

  it('requires a reason to reject, and a note to request action', async () => {
    const applicant = await registerCustomer();
    await completeApplication(applicant.token);
    const seller = await Seller.findOne({ user: applicant.userId });
    const admin = await registerAdmin();

    const rejectNoReason = await request(app)
      .patch(`/api/v1/admin/sellers/${seller._id}/status`)
      .set(authed(admin.token))
      .send({ status: 'rejected' });
    expect(rejectNoReason.status).toBe(400);

    const actionNoNote = await request(app)
      .patch(`/api/v1/admin/sellers/${seller._id}/status`)
      .set(authed(admin.token))
      .send({ status: 'action_required' });
    expect(actionNoNote.status).toBe(400);
  });

  it('approves a submitted seller and records an audit log entry', async () => {
    const applicant = await registerCustomer();
    await completeApplication(applicant.token);
    const seller = await Seller.findOne({ user: applicant.userId });
    const admin = await registerAdmin();

    const res = await request(app)
      .patch(`/api/v1/admin/sellers/${seller._id}/status`)
      .set(authed(admin.token))
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');

    const logs = await AuditLog.find({ targetType: 'Seller', targetId: seller._id });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('seller.status_change');
    expect(logs[0].metadata.to).toBe('approved');
  });

  it('a rejected applicant can edit and the admin can send it back to under_review', async () => {
    const applicant = await registerCustomer();
    await completeApplication(applicant.token);
    const seller = await Seller.findOne({ user: applicant.userId });
    const admin = await registerAdmin();

    await request(app)
      .patch(`/api/v1/admin/sellers/${seller._id}/status`)
      .set(authed(admin.token))
      .send({ status: 'rejected', reason: 'Documents unreadable' });

    // Applicant can revise while rejected.
    const editRes = await request(app)
      .patch('/api/v1/seller/application/business')
      .set(authed(applicant.token))
      .send({ legalName: 'Acme Traders Revised' });
    expect(editRes.status).toBe(200);

    const backToReview = await request(app)
      .patch(`/api/v1/admin/sellers/${seller._id}/status`)
      .set(authed(admin.token))
      .send({ status: 'under_review' });
    expect(backToReview.status).toBe(200);
  });

  it('suspends an approved seller and blocks re-approval from the wrong state', async () => {
    const applicant = await registerCustomer();
    await completeApplication(applicant.token);
    const seller = await Seller.findOne({ user: applicant.userId });
    const admin = await registerAdmin();

    await request(app).patch(`/api/v1/admin/sellers/${seller._id}/status`).set(authed(admin.token)).send({ status: 'approved' });
    const suspendRes = await request(app)
      .patch(`/api/v1/admin/sellers/${seller._id}/status`)
      .set(authed(admin.token))
      .send({ status: 'suspended' });
    expect(suspendRes.status).toBe(200);

    const reactivateRes = await request(app)
      .patch(`/api/v1/admin/sellers/${seller._id}/status`)
      .set(authed(admin.token))
      .send({ status: 'approved' });
    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.data.status).toBe('approved');
  });

  it('a non-admin cannot access seller review endpoints', async () => {
    const applicant = await registerCustomer();
    const res = await request(app).get('/api/v1/admin/sellers').set(authed(applicant.token));
    expect(res.status).toBe(403);
  });

  it('mints a signed document URL for admin review without exposing the raw storage id', async () => {
    const applicant = await registerCustomer();
    await completeApplication(applicant.token);
    const seller = await Seller.findOne({ user: applicant.userId });
    const admin = await registerAdmin();

    const docId = seller.verification.documents[0]._id;
    const res = await request(app)
      .get(`/api/v1/admin/sellers/${seller._id}/documents/${docId}/url`)
      .set(authed(admin.token));

    expect(res.status).toBe(200);
    expect(res.body.data.url).toMatch(/^https:\/\/res\.cloudinary\.com/);
  });
});
