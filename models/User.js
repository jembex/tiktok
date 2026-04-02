const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: [String], // Array of passwords
    default: [],
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
