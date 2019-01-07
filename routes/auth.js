const express = require('express');
const router = new express.Router();
const User = require('../models/user');
const { classPartialUpdate } = require('../helpers/partialUpdate');
const jwt = require('jsonwebtoken');
const { SECRET } = require('../config');

// Login a user
router.post('/login', async function (req, res, next) {
  try {
    const token = await User.authenticate(req.body);
    return res.json({ token });
  } catch (error) {
    error.status = 400;
    return next(error);
  }
});

router.post('/signup', async function (req, res, next) {
  try {
    console.log('received', req.body);
    await User.createUser(req.body);
    const token = await User.authenticate(req.body);
    return res.json({ token });
  } catch (error) {
    return next(error);
  }
})

module.exports = router;