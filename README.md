# 🛒 MERN Stack E-Commerce Platform

A production-ready, dark-themed e-commerce web application featuring secure JWT authentication, dynamic cart management, an administrative product management suite, and integrated Stripe Hosted Checkout payments.

---

## ✨ Features

* **🔐 User Authentication:** Secure signup and login powered by JWT (JSON Web Tokens) and bcrypt password hashing.
* **💳 Stripe Payments:** Seamless test-mode payment processing via Stripe Hosted Checkout.
* **🛒 Cart Management:** Real-time item additions, removals, quantity updates, and persistent state.
* **⚡ Glassmorphic Dark UI:** Modern `#09090b` aesthetic built with React and custom CSS styling.
* **🛠️ Admin Dashboard:** Administrative tools for product creation, catalog management, and image preview URLs.

---

## 🛠️ Tech Stack

| Domain | Tech |
| :--- | :--- |
| **Frontend** | React, Vite, Axios, React Router |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB, Mongoose |
| **Payments** | Stripe API |
| **Auth** | JWT, bcryptjs |

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v18+)
* **npm** (v9+)
* **MongoDB Atlas Account**
* **Stripe Developer Account**

### 1. Installation

Clone the repository and install dependencies for both server and client:

```bash
# Clone the repository
git clone [https://github.com/hariom-369/mern-ecommerce-platform.git](https://github.com/hariom-369/mern-ecommerce-platform.git)
cd mern-ecommerce-platform

# Install root, server, and client dependencies
cd server && npm install
cd ../client && npm install