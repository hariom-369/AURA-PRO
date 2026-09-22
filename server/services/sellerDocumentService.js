import { getCloudinary, isCloudinaryConfigured } from '../config/cloudinary.js';

const SIGNED_URL_TTL_SECONDS = 5 * 60;

// Uploads a seller verification document as a Cloudinary `authenticated`
// asset — access-restricted at Cloudinary's layer, not just an unlisted URL.
// Returns only what's safe to persist on the Seller doc (public_id +
// resource_type); never a directly-servable link.
export async function uploadSellerDocument(fileBuffer, { sellerId, docType }) {
  if (!isCloudinaryConfigured()) {
    const err = new Error('Document upload is not configured (missing Cloudinary credentials).');
    err.statusCode = 503;
    throw err;
  }
  const cloudinary = getCloudinary();
  const isPdf = fileBuffer.slice(0, 4).toString('utf8') === '%PDF';

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `aura-pro/seller-verification/${sellerId}`,
        resource_type: isPdf ? 'raw' : 'image',
        type: 'authenticated',
        // Not user-controlled — derived from the document `type` field the
        // caller already validated against a fixed enum.
        context: { docType },
      },
      (error, uploadResult) => (error ? reject(error) : resolve(uploadResult))
    );
    stream.end(fileBuffer);
  });

  return { publicId: result.public_id, resourceType: result.resource_type };
}

// Mints a short-lived, signed delivery URL for a previously-uploaded
// authenticated document. Called fresh on every read — never persisted.
export function getSignedDocumentUrl(publicId, resourceType = 'image') {
  const cloudinary = getCloudinary();
  if (!cloudinary) return null;
  return cloudinary.url(publicId, {
    type: 'authenticated',
    resource_type: resourceType,
    sign_url: true,
    secure: true,
    expires_at: Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS,
  });
}

export async function deleteSellerDocument(publicId, resourceType = 'image') {
  const cloudinary = getCloudinary();
  if (!cloudinary) return;
  await cloudinary.uploader.destroy(publicId, { type: 'authenticated', resource_type: resourceType });
}
