/* eslint-disable no-param-reassign,arrow-body-style */
const express = require('express');
const util = require('util');
const { check, validationResult } = require('express-validator/check');
const { db } = require('../database');
const { changeIdOfObject } = require('../services/responseFormatting');

const accounts = db.collection('Accounts');
const transactions = db.collection('Transactions');
const accountKeys = ['name', 'initialBalance'];

const router = express.Router();

// REST Endpoints //

router.get('/accounts', (req, res) => {
  util.log(util.format('/api/accounts/ - GET-Request'));
  accounts.find().toArray((error, list) => {
    list.forEach((account, index, accArr) => {
      // For sending the JSON data in the response, the _id field is converted to id in each account object
      accArr[index] = changeIdOfObject(account);
    });
    res.json(list);
  });
});

router.post('/accounts', [
  // Verification of the input data as follows:
  check('name')
    .trim()
    .not()
    .isEmpty()
    .withMessage('Name may not be empty')
    .matches(/^[a-zA-Z].*/)
    .withMessage('Name must start with a letter'),
  check('initialBalance')
    .not()
    .isEmpty()
    .withMessage('Initial balance may not be empty')
    .customSanitizer((value) => {
      return value.replace(/,/g, '.');
    })
    .toFloat()
    .isFloat()
    .withMessage('Invalid initial balance'),
], (req, res) => {
  util.log(util.format('/api/accounts/ - POST-Request: %j', req.body));

  // Checking if there are no additional fields apart from the ones specified for the account model:
  const keys = Object.keys(req.body);
  for (let i = 0; i < keys.length; i += 1) {
    if (accountKeys.indexOf(keys[i]) < 0) {
      return res.status(404).json({ error: { name: 'AccountInvalidFieldError', message: 'The account may only contain the specified fields' } });
    }
  }

  // Checking for an error in the validation above:
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: { name: 'AccountValidationError', message: errors.array()[0].msg } });
  }

  // After the verification, insert the new account object after setting the id field to _id:
  accounts.insert(req.body, (error, result) => {
    accounts.findOne(result, (innerError, updatedResult) => {
      res.status(201).send(changeIdOfObject(updatedResult));
    });
  });
});


router.put('/accounts/:id([0-9]+)', [
  // Verification of the input data as follows:
  check('name')
    .trim()
    .not()
    .isEmpty()
    .withMessage('Name may not be empty')
    .matches(/^[a-zA-Z].*/)
    .withMessage('Name must start with a letter'),
  check('initialBalance')
    .not()
    .isEmpty()
    .withMessage('Initial balance may not be empty')
    .customSanitizer((value) => {
      return value.replace(/,/g, '.');
    })
    .toFloat()
    .isFloat()
    .withMessage('Invalid initial balance'),
], (req, res) => {
  util.log(util.format('/api/accounts/%i - PUT-Request: %j', req.params.id, req.body));

  // Checking if there are no additional fields apart from the ones specified for the account model:
  const keys = Object.keys(req.body);
  for (let i = 0; i < keys.length; i += 1) {
    if (accountKeys.indexOf(keys[i]) < 0) {
      return res.status(404).json({ error: { name: 'AccountInvalidFieldError', message: 'The account may only contain the specified fields' } });
    }
  }

  // Checking for an error in the validation above:
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: { name: 'AccountValidationError', message: errors.array()[0].msg } });
  }

  const newName = req.body.name;
  const newBalance = req.body.initialBalance;
  const accountId = req.params.id;

  // After the verification, update the new account object after setting the id field to _id:
  accounts.findOne({ _id: accountId }, (err, account) => {
    if (err) {
      return res.status(500).send();
    }
    // Make sure the account to be changed exists:
    if (!account) {
      return res.status(404).json({ error: { name: 'AccountUndefinedError', message: "The account to be changed doesn't exist" } });
    }
    accounts.update({ _id: accountId }, { $set: { name: newName, initialBalance: newBalance } }, (innerErr) => {
      if (innerErr) {
        return res.status(500).send();
      }
      accounts.findOne({ _id: accountId }, (nextErr, updatedResult) => {
        res.status(201).send(changeIdOfObject(updatedResult));
      });
    });
  });
});


router.delete('/accounts/:id([0-9]+)', (req, res) => {
  util.log(util.format('/api/accounts/%i - DELETE-Request', req.params.id));
  const accountId = req.params.id;

  // Deleting an account also deletes all transactions associated with this account. User confirmation in frontend!
  // Search for the account to be deleted and delete it if it was found:
  accounts.findOne({ _id: accountId }, (err, account) => {
    if (err) {
      return res.status(500).send();
    }
    if (!account) {
      return res.status(404).json({ error: { name: 'AccountUndefinedError', message: "The account to be deleted doesn't exist" } });
    }
    transactions.remove({ account: accountId }, (innerErr) => {
      if (innerErr) {
        return res.status(500).send();
      }
      accounts.findAndRemove({ _id: accountId }, (nextErr) => {
        if (nextErr) {
          return res.status(500).send();
        }
        res.status(204).send('Success');
      });
    });
  });
});

module.exports = router;
