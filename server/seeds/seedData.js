import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Wishlist from '../models/Wishlist.js';
import Address from '../models/Address.js';

const products = [
  {
    name: 'AURA Pulse Studio Wireless Headphones',
    slug: 'aura-pulse-studio-wireless-headphones',
    brand: 'AURA',
    category: 'Audio',
    description: 'Precision-tuned active noise-canceling headphones featuring 40mm beryllium drivers and 45-hour playback capability.',
    price: 299,
    originalPrice: 349,
    discountPercentage: 14,
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1000&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?q=80&w=1000&auto=format&fit=crop'
    ],
    primaryImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=1000&auto=format&fit=crop',
    stock: 45,
    rating: 4.8,
    numReviews: 128,
    isFeatured: true,
    isNewArrival: true,
    specifications: [
      { key: 'Driver Size', value: '40mm Beryllium' },
      { key: 'Battery Life', value: '45 Hours' },
      { key: 'Connectivity', value: 'Bluetooth 5.3 / ANC' }
    ],
    tags: ['audio', 'wireless', 'anc', 'premium']
  },
  {
    name: 'AURA Horizon Smartwatch Titanium',
    slug: 'aura-horizon-smartwatch-titanium',
    brand: 'AURA',
    category: 'Wearables',
    description: 'Grade-5 Titanium smartwatch featuring an Ultra-HD Sapphire AMOLED screen with continuous biometrics tracking.',
    price: 449,
    originalPrice: 499,
    discountPercentage: 10,
    images: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000&auto=format&fit=crop'
    ],
    primaryImage: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000&auto=format&fit=crop',
    stock: 30,
    rating: 4.9,
    numReviews: 94,
    isFeatured: true,
    isNewArrival: false,
    specifications: [
      { key: 'Case Material', value: 'Grade-5 Titanium' },
      { key: 'Display', value: '1.4" Sapphire AMOLED' },
      { key: 'Water Resistance', value: '10 ATM' }
    ],
    tags: ['wearable', 'smartwatch', 'titanium']
  },
  {
    name: 'AURA VisionBook Pro 16-Inch',
    slug: 'aura-visionbook-pro-16-inch',
    brand: 'AURA',
    category: 'Laptops',
    description: 'High-performance creative workstation powered by an 8-core CPU, 32GB unified RAM, and Liquid Retina XDR screen.',
    price: 2199,
    originalPrice: 2399,
    discountPercentage: 8,
    images: [
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1000&auto=format&fit=crop'
    ],
    primaryImage: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1000&auto=format&fit=crop',
    stock: 15,
    rating: 4.7,
    numReviews: 62,
    isFeatured: true,
    isNewArrival: true,
    specifications: [
      { key: 'Processor', value: 'M3 Pro 12-Core' },
      { key: 'RAM', value: '32GB Unified Memory' },
      { key: 'Storage', value: '1TB NVMe SSD' }
    ],
    tags: ['laptop', 'computing', 'workstation']
  },
  {
    name: 'AURA KeyCraft CNC Mechanical Keyboard',
    slug: 'aura-keycraft-cnc-mechanical-keyboard',
    brand: 'AURA',
    category: 'Accessories',
    description: 'Anodized aluminum body mechanical keyboard with custom tuned linear switches and hot-swappable PCB.',
    price: 189,
    originalPrice: 219,
    discountPercentage: 13,
    images: [
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?q=80&w=1000&auto=format&fit=crop'
    ],
    primaryImage: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?q=80&w=1000&auto=format&fit=crop',
    stock: 60,
    rating: 4.6,
    numReviews: 41,
    isFeatured: false,
    isNewArrival: true,
    specifications: [
      { key: 'Layout', value: '75% Compact' },
      { key: 'Switches', value: 'AURA Custom Linear' },
      { key: 'Plate', value: 'FR4 Gasket Mount' }
    ],
    tags: ['keyboard', 'accessories', 'custom']
  }
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for seeding.');

    await Promise.all([
      Product.deleteMany({}),
      User.deleteMany({}),
      Wishlist.deleteMany({}),
      Address.deleteMany({})
    ]);

    console.log('Cleared existing junk database records.');

    // No demo users are seeded here — accounts only exist once someone signs
    // in with Firebase Phone Auth (see services/firebasePhoneAuthService.js).
    // To make a demo account an admin, sign in with it once, then run:
    //   node seeds/seedAdmin.js <phone-number>

    // Use create() (not insertMany) so the pre-save hook derives basePriceInPaise,
    // discountPercentage, and primaryImage from the legacy display fields above.
    for (const product of products) {
      await Product.create(product);
    }
    console.log('Successfully seeded clean AURA PRO products.');

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDatabase();