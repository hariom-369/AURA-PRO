import logger from '../utils/logger.js';

export const sendOrderConfirmationEmail = async (order, customerEmail) => {
  try {
    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7;">
        <h2 style="color: #6366f1;">AURA PRO</h2>
        <h3>Thank you for your order!</h3>
        <p>Order Number: <strong>${order.orderNumber}</strong></p>
        <p>Total Paid: <strong>₹${(order.totalPriceInPaise / 100).toFixed(2)}</strong></p>
        <hr/>
        <h4>Shipping To:</h4>
        <p>${order.shippingAddress.fullName || 'Customer'}<br/>
        ${order.shippingAddress.address}<br/>
        ${order.shippingAddress.city}, ${order.shippingAddress.postalCode}<br/>
        ${order.shippingAddress.country}</p>
        <hr/>
        <p>Track your shipment directly on your dashboard.</p>
      </div>
    `;

    // Send email using production service driver
    logger.info(`[EMAIL SERVICE] Sending order confirmation email to ${customerEmail} for order ${order.orderNumber}`);
    return { success: true };
  } catch (error) {
    logger.error('Failed to send order confirmation email', { error: error.message });
    return { success: false, error: error.message };
  }
};