# AURA PRO — Enterprise MERN E-Commerce Platform

AURA PRO is a production-hardened, scalable, and secure full-stack e-commerce platform built on the MERN stack (MongoDB, Express.js, React, Node.js). Engineered for high performance and security compliance, it includes JWT authentication, role-based access control, Stripe payment processing, Cloudinary media management, custom administrative tooling, and Progressive Web App (PWA) readiness.

---

## 🛠️ Technical Stack

* **Frontend:** React 18+, Vite, React Router, Axios, Tailwind CSS / CSS Modules
* **PWA & SEO:** Web App Manifest (`manifest.json`), Apple touch icons, Open Graph metadata, responsive mobile viewport configuration
* **Backend:** Node.js, Express.js (ES Modules / ESM)
* **Database:** MongoDB Atlas with Mongoose ORM
* **Authentication:** JSON Web Tokens (JWT) & `bcryptjs` password hashing
* **Payment Gateway:** Stripe API (Stripe Checkout)
* **Storage & Media:** Cloudinary API
* **Development Utilities:** `dotenv`, `nodemon`, `concurrently`

---

## 🔒 Security Infrastructure (`server/middleware/security.js`)

| Security Layer | Package | Operational Function |
| :--- | :--- | :--- |
| **HTTP Security Headers** | `helmet` | Enforces Content Security Policy (CSP) enabling Stripe (`js.stripe.com`) and Cloudinary domains. |
| **CORS Policy** | `cors` | Restricts cross-origin resource sharing to authorized frontend origins (`CLIENT_URL`). |
| **General Rate Limiting** | `express-rate-limit` | Caps standard API calls at 300 requests per 15 minutes per IP. |
| **Auth Rate Limiting** | `express-rate-limit` | Locks authentication endpoints to 10 attempts per hour per IP. |
| **Checkout Rate Limiting**| `express-rate-limit` | Limits checkout operations to 15 attempts per 10 minutes per IP. |
| **NoSQL Injection Guard**| `express-mongo-sanitize` | Strips prohibited `$` and `.` characters from incoming request payloads. |
| **Parameter Protection** | `hpp` | Prevents HTTP Parameter Pollution while whitelisting query fields (`category`, `price`, `rating`, `sort`). |
| **Global Error Handling** | Custom Middleware | Standardizes error responses and masks internal 500 error specifics in production. |

---

## 📁 Complete Project Structure

```text
ecommerce-platform/
├── .gitignore                      # Global Git ignore rules protecting environment files & builds
├── README.md                       # Comprehensive project documentation
├── client/                         # Frontend React Application
│   ├── public/
│   │   ├── favicon.ico             # Browser icon
│   │   ├── icon-192.png            # PWA 192x192 icon
│   │   ├── icon-512.png            # PWA 512x512 icon
│   │   └── manifest.json           # Web App Manifest for PWA installation
│   ├── src/                        # React source code (components, pages, context)
│   └── index.html                  # HTML root template with SEO and PWA bindings
└── server/                         # Backend Express API Application
    ├── config/                     # Database & third-party service connections
    ├── controllers/                # Logic handlers (Auth, Products, Cart, Orders)
    ├── middleware/
    │   ├── authMiddleware.js       # JWT authorization & role-based access control
    │   ├── errorMiddleware.js      # Global error middleware with production masking
    │   └── security.js             # Helmet, CORS, Rate Limiters, Sanitizer, HPP
    ├── models/
    │   └── User.js                 # User & Admin Mongoose schema
    ├── routes/
    │   ├── authRoutes.js           # Authentication & user endpoints
    │   ├── cartRoutes.js           # Shopping cart operations
    │   ├── orderRoutes.js          # Order processing & Stripe checkout
    │   └── productRoutes.js        # Product catalog CRUD endpoints
    ├── seeds/
    │   ├── seedAdmin.js            # CLI utility script to seed or upgrade Admin accounts
    │   └── seedData.js             # Initial product catalog population script
    ├── services/                   # Service layer wrappers (Stripe, Cloudinary)
    ├── utils/
    │   ├── ApiError.js             # Operational error handling class
    │   ├── ApiResponse.js          # Standardized API response format
    │   └── asyncHandler.js         # Async route wrapper for Express
    ├── validators/                 # Input validation schema functions
    ├── .env                        # Active local secret keys (Git-ignored)
    ├── .env.example                # Safe environment variable configuration template
    ├── app.js                      # Express application middleware pipeline
    └── server.js                   # Application entry point & database server listener


    EndpointMethodRolePurpose/api/healthGETPublicSystem health check and status verification/api/v1/auth/registerPOSTPublicRegister a new customer account/api/v1/auth/loginPOSTPublicAuthenticate user credentials and return JWT/api/v1/productsGETPublicFetch product catalog with filtering/sorting/api/v1/productsPOSTAdminCreate a new catalog item/api/v1/cartGETUserRetrieve current user's cart/api/v1/cartPOSTUserAdd or update item in cart/api/v1/ordersPOSTUserInitiate Stripe Checkout session🔍 Major Optimization & Troubleshooting MilestonesES Module Variable Hoisting Fix:Issue: process.env returned undefined in imported services because ESM imports execute before top-level dotenv.config().Solution: Standardized environment initialization across entry scripts before importing dependent local modules.Stripe SDK Initialization Safeguard:Issue: Stripe threw runtime errors when initialized without pre-loaded API keys.Solution: Ensured environment variables load ahead of service module resolution.MongoDB Connection String & Database Targeting:Issue: MongoDB connection threw bad auth and defaulted to creating records in the fallback test database.Solution: Configured MONGO_URI to explicitly target the aura_pro database with authenticated user parameters.Production Security Guardrails Integration:Issue: System required defenses against NoSQL injection, parameter pollution, and auth brute-forcing.Solution: Centralized security stack in server/middleware/security.js utilizing helmet, cors, express-rate-limit, express-mongo-sanitize, and hpp.