# Fixing 400 Bad Request on Identity Toolkit API

## Error: `400 Bad Request` on `sendVerificationCode`

This error means the Identity Toolkit API request is being rejected. Common causes:

1. **Identity Toolkit API not enabled**
2. **API key restrictions blocking the request**
3. **Billing not enabled** (some features require billing)
4. **Request payload issues** (less common with FirebaseUI)

## Step-by-Step Fix

### Step 1: Enable Identity Toolkit API

**Option A: Via Google Cloud Console (Recommended)**

1. Go to **Google Cloud Console**: https://console.cloud.google.com/
2. Select project: **`strokesnchokes`**
3. Go to **APIs & Services** → **Library** (left sidebar)
4. Search for: **"Identity Toolkit API"**
5. Click on **"Identity Toolkit API"**
6. Click the **"ENABLE"** button
7. Wait 2-5 minutes for activation

**Option B: Via Firebase Console**

1. Go to **Firebase Console**: https://console.firebase.google.com/
2. Select project: **`strokesnchokes`**
3. Go to **Authentication** → **Sign-in method**
4. Click on **Phone**
5. Toggle **Enable** if not already enabled
6. Click **Save**

This should automatically enable Identity Toolkit API in the background.

### Step 2: Check API Key Restrictions

1. In **Google Cloud Console**, go to **APIs & Services** → **Credentials**
2. Find your API key: **`AIzaSyC35u2oF6k3oiGpPRde77b2gz6OWMmmy2E`**
3. Click on it to edit
4. Check **API restrictions**:
   - **Option 1 (Recommended for dev)**: Set to **"Don't restrict key"**
   - **Option 2**: If restricted, make sure **"Identity Toolkit API"** is in the list
5. Check **Application restrictions**:
   - For localhost testing: Set to **"None"** OR
   - If using "HTTP referrers", add:
     - `http://localhost:*`
     - `http://127.0.0.1:*`
6. Click **Save**

### Step 3: Verify API is Enabled

1. In **Google Cloud Console**, go to **APIs & Services** → **Enabled APIs**
2. Look for **"Identity Toolkit API"** in the list
3. It should show **"Enabled"** status
4. If not there, go back to Step 1

### Step 4: Check Billing (if needed)

Some Firebase features require billing to be enabled:

1. Go to **Google Cloud Console** → **Billing**
2. Check if billing is enabled for project `strokesnchokes`
3. If not enabled and you see billing errors:
   - Enable billing (Firebase has a free tier)
   - Phone authentication may have quotas without billing

### Step 5: Wait and Test

1. **Wait 5-10 minutes** after enabling the API (propagation time)
2. **Clear browser cache** (Ctrl+Shift+Delete)
3. **Hard refresh** the page (Ctrl+Shift+R)
4. **Try again**

## Verification Checklist

- [ ] Identity Toolkit API is enabled in Google Cloud Console
- [ ] API key has "Don't restrict key" OR includes "Identity Toolkit API"
- [ ] Application restrictions allow localhost (or set to "None")
- [ ] Phone Authentication is enabled in Firebase Console
- [ ] Waited 5-10 minutes after enabling
- [ ] Browser cache cleared
- [ ] Page hard refreshed

## Quick Test

After enabling, you can test if the API is accessible:

1. Open browser console (F12)
2. Try the login flow
3. Check the Network tab for the `sendVerificationCode` request
4. Look at the response - should be 200 OK, not 400 Bad Request

## Common Issues

### Issue: "API not enabled"
**Fix**: Enable Identity Toolkit API in Google Cloud Console → APIs & Services → Library

### Issue: "API key restrictions"
**Fix**: Set API restrictions to "Don't restrict key" or add "Identity Toolkit API" to the list

### Issue: "Application restrictions blocking"
**Fix**: Set Application restrictions to "None" or add `http://localhost:*`

### Issue: "Billing required"
**Fix**: Enable billing in Google Cloud Console (Firebase has free tier)

## Your Current Setup

- **API Key**: `AIzaSyC35u2oF6k3oiGpPRde77b2gz6OWMmmy2E`
- **Project**: `strokesnchokes`
- **Required API**: Identity Toolkit API
- **Endpoint**: `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode`

## Still Getting 400?

1. **Check the exact error message** in browser console Network tab
2. **Verify the API key** matches what's in Firebase Console
3. **Try the other API key** (`AIzaSyA--bBHfUsqgjRKDOqY-lMSVJJBLR3SfuY`) - make sure it's the Browser key
4. **Check Firebase Console** → **Authentication** → **Usage** for quota errors
5. **Wait longer** - API enabling can take up to 10 minutes


