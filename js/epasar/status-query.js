(function () {
  'use strict';
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';
  const code = params.get('code') || '';
  const tokenField = document.getElementById('publicToken');
  const codeField = document.getElementById('registrationCode');
  const form = document.getElementById('statusForm');
  if (token && tokenField) tokenField.value = token;
  if (code && codeField) codeField.value = code;
  if (token && code && form) form.requestSubmit();
}());
