# Fixing reCAPTCHA on Localhost

## Problem
- Test phone numbers work (they bypass reCAPTCHA)
- Real phone numbers fail with "Authentication error"
- reCAPTCHA is not working on localhost

## Solution: Authorize Localhost in Firebase

### Step 1: Add localhost to Authorized Domains

1. **Go to Firebase Console**
   - Navigate to https://console.firebase.google.com/
   - Select your project: `strokesnchokes`

2. **Open Authentication Settings**
   - Go to **Authentication** → **Settings** (gear icon at the top)
   - Scroll down to **Authorized domains**

3. **Add localhost**
   - Click **Add domain**
   - Enter: `localhost`
   - Click **Add**
   - Also add: `127.0.0.1` (if not already there)

4. **Verify the list includes:**
   - `localhost`
   - `127.0.0.1`
   - Your production domain (if you have one)

### Step 2: Check Browser Console

After adding localhost, check the browser console when submitting a phone number. You should see:
- `Initializing reCAPTCHA verifier...`
- `Rendering reCAPTCHA...`
- `reCAPTCHA rendered successfully, widget ID: [number]`
- `Sending verification code with reCAPTCHA...`
- `Verification code sent successfully`

### Step 3: If Still Not Working

If reCAPTCHA still fails after adding localhost:

1. **Clear browser cache and cookies**
2. **Try a different browser** (Chrome, Firefox, Edge)
3. **Check for browser extensions** that might block reCAPTCHA
4. **Try using `127.0.0.1` instead of `localhost`** in your browser URL

### Step 4: Alternative - Use Visible reCAPTCHA (for testing)

If invisible reCAPTCHA continues to fail, you can temporarily switch to visible reCAPTCHA for debugging:

In `Login.jsx`, change:
```javascript
size: 'invisible', // Change this
```

To:
```javascript
size: 'normal', // Visible reCAPTCHA for testing
```

And change the container div:
```javascript
<div id="recaptcha-container" ref={recaptchaContainerRef}></div>
// Remove style={{ display: 'none' }}
```

## Why This Happens

- Firebase requires domains to be explicitly authorized for security
- Test phone numbers bypass reCAPTCHA, so they work without authorization
- Real phone numbers require reCAPTCHA verification, which needs an authorized domain
- Localhost is not automatically authorized (you must add it manually)

## Important Notes

- Changes to authorized domains take effect immediately (no rebuild needed)
- You only need to do this once per Firebase project
- This only affects web/localhost - Android builds use different verification methods

