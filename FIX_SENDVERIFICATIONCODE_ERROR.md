# Fixing AuthenticationService.SendVerificationCode Error

## Error: `AuthenticationService.SendVerificationCode`

This error in Google Cloud Console means the **Identity Toolkit API** is not enabled or not accessible for your project.

## Quick Fix Steps

### Step 1: Enable Identity Toolkit API

1. **Go to Google Cloud Console**
   - Navigate to: https://console.cloud.google.com/
   - Select project: **`strokesnchokes`**

2. **Enable the API**
   - Click **APIs & Services** → **Library** (left sidebar)
   - Search for: **"Identity Toolkit API"**
   - Click on **"Identity Toolkit API"**
   - Click the **"ENABLE"** button
   - Wait 1-2 minutes for activation

### Step 2: Verify API Key Has Access

1. Go to **APIs & Services** → **Credentials**
2. Click on your API key: `AIzaSyC35u2oF6k3oiGpPRde77b2gz6OWMmmy2E`
3. Check **API restrictions**:
   - Should be **"Don't restrict key"** OR
   - Should include **"Identity Toolkit API"** in the restricted list
4. If restricted and Identity Toolkit API is missing:
   - Click **Restrict key**
   - Add **"Identity Toolkit API"** to the list
   - Click **Save**

### Step 3: Check Billing/Quotas

1. Go to **APIs & Services** → **Dashboard**
2. Find **"Identity Toolkit API"**
3. Check for any quota or billing errors
4. If you see quota errors, you may need to:
   - Enable billing for the project
   - Request quota increase
   - Check usage limits

### Step 4: Alternative - Enable via Firebase Console

Sometimes enabling through Firebase Console is easier:

1. Go to **Firebase Console**: https://console.firebase.google.com/
2. Select project: `strokesnchokes`
3. Go to **Authentication** → **Sign-in method**
4. Click on **Phone**
5. Toggle **Enable** if not already enabled
6. Click **Save**

This should automatically enable the Identity Toolkit API in the background.

## Verification Checklist

After enabling, verify everything is set up:

- [ ] Identity Toolkit API shows "Enabled" in Google Cloud Console
- [ ] API key has Identity Toolkit API in restrictions (or "Don't restrict key")
- [ ] Phone Authentication is enabled in Firebase Console
- [ ] No billing/quota errors in Google Cloud Console
- [ ] Waited 2-5 minutes after enabling for changes to propagate

## Still Getting Errors?

1. **Wait 5-10 minutes** - API enabling can take time
2. **Clear browser cache** and try again
3. **Check Google Cloud Console** → **APIs & Services** → **Enabled APIs** to confirm it's listed
4. **Check Firebase Console** → **Authentication** → **Usage** for any errors
5. **Verify billing** is enabled for the project (some APIs require billing)

## Common Causes

1. **API not enabled** - Most common cause
2. **API key restrictions** - Key doesn't have permission
3. **Billing not enabled** - Some features require billing
4. **Quota exceeded** - Check usage limits
5. **Project permissions** - Make sure you have admin access

## Your Project Details

- **Project**: `strokesnchokes`
- **API Key**: `AIzaSyC35u2oF6k3oiGpPRde77b2gz6OWMmmy2E`
- **Required API**: Identity Toolkit API
- **Firebase Project**: `strokesnchokes`

