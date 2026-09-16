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
| **Checkout Rate Limiting** | `express-rate-limit` | Limits checkout operations to 15 attempts per 10 minutes per IP. |
| **NoSQL Injection Guard** | `express-mongo-sanitize` | Strips prohibited `$` and `.` characters from incoming request payloads. |
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
    │   ├── ApiResponse.js           # Standardized API response format
    │   └── asyncHandler.js          # Async route wrapper for Express
    ├── validators/                 # Input validation schema functions
    ├── .env                        # Active local secret keys (Git-ignored)
    ├── .env.example                # Safe environment variable configuration template
    ├── app.js                      # Express application middleware pipeline
    └── server.js                   # Application entry point & database server listener
```

---

## ⚙️ Environment Configuration

Set up the `.env` file in the `server/` directory using these values:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=
JWT_SECRET=
CLIENT_URL=http://localhost:5173

# Payment Keys (Stripe)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Image Storage Keys (Cloudinary)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Email Service Keys
EMAIL_API_KEY=
EMAIL_FROM_ADDRESS=orders@aurapro.com
```

> **Security note:** The values above contain credentials/secrets. For a real repository, do not commit live database passwords, JWT secrets, Stripe secret keys, or other private credentials. Store secrets in environment variables and keep `.env` Git-ignored. If any of the credentials shown above are real and active, rotate them before publishing the repository.

---

## 🚀 Local Setup & Installation

### 1. Install Dependencies

Install packages for both the client and server applications:

```bash
# Install Server Dependencies
cd server
npm install

# Install Client Dependencies
cd ../client
npm install
```

### 2. Admin Account Initialization

Run the automated CLI seeding utility to set up or upgrade an administrator account:

```bash
cd server
node seeds/seedAdmin.js <admin-email> <admin-password>
```

### 3. Run Development Servers

Start the backend API and frontend client in separate terminal windows:

```bash
# Terminal 1: Backend API (http://localhost:5000)
cd server
npm run dev

# Terminal 2: Frontend Client (http://localhost:5173)
cd client
npm run dev
```

---

## 📡 API Reference Overview (`/api/v1`)

| **Endpoint** | **Method** | **Role** | **Purpose** |
| --- | --- | --- | --- |
| `/api/health` | `GET` | Public | System health check and status verification |
| `/api/v1/auth/register` | `POST` | Public | Register a new customer account |
| `/api/v1/auth/login` | `POST` | Public | Authenticate user credentials and return JWT |
| `/api/v1/products` | `GET` | Public | Fetch product catalog with filtering/sorting |
| `/api/v1/products` | `POST` | Admin | Create a new catalog item |
| `/api/v1/cart` | `GET` | User | Retrieve current user's cart |
| `/api/v1/cart` | `POST` | User | Add or update item in cart |
| `/api/v1/orders` | `POST` | User | Initiate Stripe Checkout session |

---

## 🔍 Major Optimization & Troubleshooting Milestones

1. **ES Module Variable Hoisting Fix:**
   - **Issue:** `process.env` returned `undefined` in imported services because ESM imports execute before top-level `dotenv.config()`.
   - **Solution:** Standardized environment initialization across entry scripts before importing dependent local modules.

2. **Stripe SDK Initialization Safeguard:**
   - **Issue:** Stripe threw runtime errors when initialized without pre-loaded API keys.
   - **Solution:** Ensured environment variables load ahead of service module resolution.

3. **MongoDB Connection String & Database Targeting:**
   - **Issue:** MongoDB connection threw `bad auth` and defaulted to creating records in the fallback `test` database.
   - **Solution:** Configured `MONGO_URI` to explicitly target the `aura_pro` database with authenticated user parameters.

4. **Production Security Guardrails Integration:**
   - **Issue:** System required defenses against NoSQL injection, parameter pollution, and auth brute-forcing.
   - **Solution:** Centralized security stack in `server/middleware/security.js` utilizing `helmet`, `cors`, `express-rate-limit`, `express-mongo-sanitize`, and `hpp`.

---

## 🧪 Testing API Endpoints via PowerShell

To register a test user directly via PowerShell:

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/auth/register" -Method Post -Headers @{"Content-Type"="application/json"} -Body '{"name":"Test User","email":"test@aurapro.com","password":"Password123!"}'
```

---

## 👥 User & Admin Access

AURA PRO is designed to support both regular customers and administrators.

### Regular Customers

Regular users can use the customer-facing e-commerce functionality, including:

- Registering and logging into an account
- Browsing the product catalog
- Filtering and sorting products
- Managing their shopping cart
- Placing orders
- Initiating secure Stripe Checkout sessions

### Administrators

Administrators have privileged access controlled through JWT authentication and role-based authorization. Administrative functionality includes product/catalog management and administrator account initialization through the provided seeding utility.

---

## 💳 Payments

Stripe is integrated through the Stripe API and Stripe Checkout.

The backend uses a dedicated checkout rate limiter to reduce abuse of checkout operations. Stripe-related environment variables are configured in `server/.env`.

Required variables include:

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

## ☁️ Media Storage

Cloudinary is used as the external media/storage service for product and application media.

Configure the following variables in `server/.env`:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

---

## 📧 Email Configuration

The environment configuration includes support for an external email service:

```env
EMAIL_API_KEY=
EMAIL_FROM_ADDRESS=orders@aurapro.com
```

The sender address is configured as `orders@aurapro.com`.

---

## 📱 PWA & SEO Readiness

The frontend includes Progressive Web App and SEO-oriented configuration.

Included assets and configuration include:

- `client/public/manifest.json`
- `client/public/icon-192.png`
- `client/public/icon-512.png`
- `client/public/favicon.ico`
- Responsive mobile viewport configuration
- Apple touch icon support
- Open Graph metadata
- PWA installation readiness
- SEO-related bindings in `client/index.html`

---

## 🧱 Architecture Overview

AURA PRO follows a separated MERN architecture:

```text
React + Vite Frontend
        │
        │ Axios / HTTP
        ▼
Express.js REST API
        │
        ├── Authentication & Authorization
        ├── Security Middleware
        ├── Controllers
        ├── Validators
        ├── Services
        │     ├── Stripe
        │     └── Cloudinary
        └── Routes
              │
              ▼
        MongoDB Atlas
              │
              ▼
          Mongoose ORM
```

The frontend communicates with the Express backend through REST APIs. The backend handles authentication, authorization, validation, business logic, payment initialization, media-service integration, and database operations.

---

## 🛡️ Security Practices

The platform includes multiple layers of application security:

- JWT-based authentication
- Role-based access control
- `bcryptjs` password hashing
- Helmet HTTP security headers
- Content Security Policy configuration
- Restricted CORS origins
- General API rate limiting
- Authentication endpoint rate limiting
- Checkout endpoint rate limiting
- NoSQL injection protection
- HTTP Parameter Pollution protection
- Centralized error handling
- Production error-detail masking
- Environment-variable based secret management
- Git-ignored `.env` configuration

Sensitive configuration should never be committed to source control.

---

## 🧰 Development Utilities

The project uses the following development utilities:

- `dotenv` for environment-variable configuration
- `nodemon` for backend development auto-restart
- `concurrently` for running multiple development processes
- Vite for fast frontend development and builds

---

## 🌱 Database & Seed Utilities

The backend provides seed scripts for initial application setup:

```text
server/seeds/
├── seedAdmin.js
└── seedData.js
```

### `seedAdmin.js`

Used to create or upgrade an administrator account:

```bash
cd server
node seeds/seedAdmin.js admin@aurapro.com SecureAdminPassword123
```

### `seedData.js`

Used to populate the initial product catalog.

---

## 🧪 Development Testing

### Backend Health Check

Once the backend is running, the health endpoint can be used to verify API availability:

```text
GET http://localhost:5000/api/health
```

### Test User Registration

PowerShell:

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/auth/register" -Method Post -Headers @{"Content-Type"="application/json"} -Body '{"name":"Test User","email":"test@aurapro.com","password":"Password123!"}'
```

---

## 📝 Environment Variable Reference

| Variable | Purpose |
| --- | --- |
| `PORT` | Backend server port |
| `NODE_ENV` | Application environment |
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret used for JWT authentication |
| `CLIENT_URL` | Authorized frontend origin |
| `STRIPE_SECRET_KEY` | Stripe server-side API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification secret |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud identifier |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `EMAIL_API_KEY` | External email service API key |
| `EMAIL_FROM_ADDRESS` | Email sender address |

---

## 📌 Important Configuration Notes

- Backend configuration belongs in `server/.env`.
- Never commit `server/.env` to Git.
- Use `server/.env.example` as the safe template for required environment variables.
- The frontend development server runs on port `5173` by default.
- The backend development server runs on port `5000`.
- `CLIENT_URL` must match the frontend origin used by the backend.
- Stripe and Cloudinary credentials must be configured before their respective integrations can operate.
- MongoDB credentials and connection settings must be valid for successful database initialization.
- Authentication and authorization depend on a properly configured `JWT_SECRET`.

---

## 🏁 Quick Start

```bash
# 1. Clone/open the project
cd ecommerce-platform

# 2. Install server dependencies
cd server
npm install

# 3. Configure environment variables
# Create server/.env using the configuration above

# 4. Initialize admin account
node seeds/seedAdmin.js admin@aurapro.com SecureAdminPassword123

# 5. Start backend
npm run dev

# 6. Open another terminal and install frontend dependencies
cd ../client
npm install

# 7. Start frontend
npm run dev
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/health
```

---

## 📄 License

This project is documented as the AURA PRO Enterprise MERN E-Commerce Platform. Add the project's chosen open-source or proprietary license here before public distribution.
