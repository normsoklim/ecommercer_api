const BASE = 'http://localhost:3001/api/v1';

async function call(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { status: response.status, body };
}

async function main() {
  const login = await call('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'cart.tester@example.com',
      password: 'Password123!',
    }),
  });

  if (login.status !== 200) {
    console.log('LOGIN FAILED', login.status, login.body);
    return;
  }

  const token = login.body.accessToken;
  const auth = { Authorization: `Bearer ${token}` };

  const products = await call('/products?limit=50');
  const withStock = products.body.data.filter(
    (product) =>
      product.inventory &&
      product.inventory.some(
        (entry) => entry.quantity - entry.reservedQuantity > 2,
      ),
  );

  console.log('products with stock:', withStock.length);

  if (withStock.length === 0) {
    console.log('NO STOCK AVAILABLE');
    return;
  }

  const product = withStock[0];
  const variantId = product.variants?.length ? product.variants[0].id : undefined;

  await call('/cart/clear', { method: 'DELETE', headers: auth });

  const added = await call('/cart/add', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      productId: product.id,
      variantId,
      quantity: 1,
    }),
  });

  console.log('add to cart:', added.status, JSON.stringify(added.body).slice(0, 200));

  const cart = await call('/cart', { headers: auth });
  console.log('cart items:', cart.body.items?.length);

  const checkout = await call('/checkout', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      idempotencyKey: `test-checkout-${Date.now()}`,
      shippingAddress: {
        firstName: 'Cart',
        lastName: 'Tester',
        company: 'ShopEase',
        addressLine1: '123 Rama IV Road',
        addressLine2: 'Sukhumvit 21',
        city: 'Bangkok',
        state: 'Bangkok',
        postalCode: '10110',
        country: 'TH',
        phone: '+6612345678',
      },
    }),
  });

  console.log('checkout:', checkout.status, JSON.stringify(checkout.body).slice(0, 400));

  if (checkout.status !== 201 && checkout.status !== 200) {
    return;
  }

  const order = checkout.body;

  const payment = await call('/payments/khqr', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      orderId: order.id,
      provider: 'BAKONG_KHQR',
      currency: 'USD',
      idempotencyKey: `test-payment-${Date.now()}`,
    }),
  });

  console.log(
    'khqr payment:',
    payment.status,
    payment.body?.id,
    payment.body?.amountInMajorUnits,
    payment.body?.currency,
    payment.body?.qrCodeImage ? 'qr-image-present' : 'no-qr-image',
  );

  if (payment.body?.id) {
    const status = await call(`/payments/${payment.body.id}/khqr-status`, {
      headers: auth,
    });

    console.log(
      'khqr status:',
      status.status,
      status.body?.payment?.status,
      'expired:',
      status.body?.isExpired,
    );

    const verify = await call(`/payments/${payment.body.id}/verify-khqr`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({}),
    });

    console.log(
      'verify:',
      verify.status,
      verify.body?.success,
      verify.body?.message,
    );
  }

  const orders = await call('/orders?limit=5', { headers: auth });
  console.log(
    'orders:',
    orders.status,
    JSON.stringify(orders.body?.data?.map((o) => [o.orderNumber, o.status])),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
