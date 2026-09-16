export const generateHTMLInvoice = (order) => {
  const itemsRows = order.orderItems
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${(item.priceInPaise / 100).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${((item.priceInPaise * item.quantity) / 100).toFixed(2)}</td>
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice - ${order.orderNumber}</title>
    </head>
    <body style="font-family: sans-serif; padding: 30px; color: #333;">
      <table style="width: 100%;">
        <tr>
          <td><h2>AURA PRO E-COMMERCE</h2></td>
          <td style="text-align: right;"><h3>INVOICE</h3><p>Invoice #: INV-${order.orderNumber}<br/>Date: ${new Date(order.createdAt).toLocaleDateString()}</p></td>
        </tr>
      </table>
      <hr/>
      <table style="width: 100%; margin: 20px 0;">
        <tr>
          <td>
            <strong>Billed To:</strong><br/>
            ${order.shippingAddress.fullName || 'Valued Customer'}<br/>
            ${order.shippingAddress.address}<br/>
            ${order.shippingAddress.city}, ${order.shippingAddress.postalCode}
          </td>
          <td style="text-align: right;">
            <strong>Payment Method:</strong> ${order.paymentMethod}<br/>
            <strong>Status:</strong> ${order.paymentStatus}
          </td>
        </tr>
      </table>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f4f4f5;">
            <th style="padding: 8px; text-align: left;">Item</th>
            <th style="padding: 8px; text-align: center;">Qty</th>
            <th style="padding: 8px; text-align: right;">Unit Price</th>
            <th style="padding: 8px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>
      <table style="width: 100%; margin-top: 20px;">
        <tr>
          <td style="width: 60%;"></td>
          <td style="width: 40%;">
            <table style="width: 100%;">
              <tr><td>Subtotal:</td><td style="text-align: right;">₹${(order.itemsPriceInPaise / 100).toFixed(2)}</td></tr>
              <tr><td>Tax (GST):</td><td style="text-align: right;">₹${(order.taxPriceInPaise / 100).toFixed(2)}</td></tr>
              <tr><td>Shipping:</td><td style="text-align: right;">₹${(order.shippingPriceInPaise / 100).toFixed(2)}</td></tr>
              <tr style="font-size: 1.2em; font-weight: bold;"><td>Grand Total:</td><td style="text-align: right;">₹${(order.totalPriceInPaise / 100).toFixed(2)}</td></tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};