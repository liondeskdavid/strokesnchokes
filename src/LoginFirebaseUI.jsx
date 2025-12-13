import React, { useEffect, useRef, useState } from 'react';
import * as firebaseui from 'firebaseui';
import 'firebaseui/dist/firebaseui.css';
import { PhoneAuthProvider, signInAnonymously } from 'firebase/auth';
import { authCompat, auth } from './firebase';

// Add custom CSS to ensure reCAPTCHA is visible
const customStyles = `
    .firebaseui-recaptcha-wrapper {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        margin: 10px 0 !important;
    }
    .firebaseui-recaptcha-container {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
    }
    iframe[src*="recaptcha"] {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
    }
    #recaptcha-container {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
    }
`;

const LoginFirebaseUI = ({ onLoginSuccess }) => {
    const uiRef = useRef(null);
    const containerRef = useRef(null);
    const [isSigningIn, setIsSigningIn] = useState(false);

    const handleAnonymousLogin = async () => {
        if (!auth) return;
        
        setIsSigningIn(true);
        try {
            await signInAnonymously(auth);
            onLoginSuccess();
        } catch (error) {
            console.error('Anonymous sign-in error:', error);
            setIsSigningIn(false);
        }
    };

    useEffect(() => {
        if (!authCompat || !containerRef.current) return;

        // Inject custom CSS to ensure reCAPTCHA is visible
        const styleElement = document.createElement('style');
        styleElement.setAttribute('data-firebaseui-recaptcha', 'true');
        styleElement.textContent = customStyles;
        document.head.appendChild(styleElement);

        // Check if FirebaseUI already has an instance for this auth
        let ui = firebaseui.auth.AuthUI.getInstance();
        
        if (!ui) {
            // No existing instance, create a new one using compat auth
            ui = new firebaseui.auth.AuthUI(authCompat);
        }
        
        uiRef.current = ui;

        // Configure FirebaseUI for phone authentication only
        const uiConfig = {
            signInOptions: [
                {
                    provider: PhoneAuthProvider.PROVIDER_ID,
                    defaultCountry: 'US', // Default to US (+1)
                    recaptchaParameters: {
                        type: 'image', // Use image reCAPTCHA
                        size: 'normal', // Normal size - ensures visible reCAPTCHA
                        badge: 'bottomright' // Position of reCAPTCHA badge
                    },
                }
            ],
            signInFlow: 'popup', // Use popup flow
            callbacks: {
                signInSuccessWithAuthResult: (authResult, redirectUrl) => {
                    // User successfully signed in
                    console.log('Sign-in successful:', authResult);
                    onLoginSuccess();
                    // Return false to prevent redirect
                    return false;
                },
                signInFailure: (error) => {
                    console.error('FirebaseUI sign-in error:', error);
                    console.error('Error code:', error.code);
                    console.error('Error message:', error.message);
                    console.error('Full error:', JSON.stringify(error, null, 2));
                    
                    // If it's an invalid-app-credential error, provide helpful message
                    if (error.code === 'auth/invalid-app-credential') {
                        const currentHost = window.location.hostname;
                        console.error('INVALID_APP_CREDENTIAL Error Details:');
                        console.error('Current hostname:', currentHost);
                        console.error('Current origin:', window.location.origin);
                        console.error('');
                        console.error('To fix this:');
                        console.error('1. Go to Firebase Console → Authentication → Settings → Authorized domains');
                        console.error('2. Make sure "' + currentHost + '" is in the list');
                        console.error('3. If not, click "Add domain" and add it');
                        console.error('4. Go to Google Cloud Console → APIs & Services → Credentials');
                        console.error('5. Find your API key and check Application restrictions');
                        console.error('6. Make sure localhost is allowed or restrictions are set to "None"');
                        console.error('7. Check that Identity Toolkit API is enabled');
                    }
                    
                    // Handle error - FirebaseUI will display it
                    return Promise.resolve();
                }
            },
        };

        // Check if UI is already rendered in this container
        // Only start if container is empty
        if (containerRef.current && containerRef.current.children.length === 0) {
            try {
                console.log('Starting FirebaseUI with config:', uiConfig);
                ui.start(containerRef.current, uiConfig);
                
                // Wait a bit and check if reCAPTCHA container exists
                setTimeout(() => {
                    const recaptchaElements = document.querySelectorAll('[id*="recaptcha"], iframe[src*="recaptcha"]');
                    console.log('reCAPTCHA elements found:', recaptchaElements.length);
                    recaptchaElements.forEach((el, idx) => {
                        console.log(`reCAPTCHA element ${idx}:`, el);
                        console.log(`  - Display:`, window.getComputedStyle(el).display);
                        console.log(`  - Visibility:`, window.getComputedStyle(el).visibility);
                        console.log(`  - Opacity:`, window.getComputedStyle(el).opacity);
                    });
                }, 2000);
            } catch (err) {
                // If instance was deleted, create a new one and try again
                if (err.message && err.message.includes('deleted')) {
                    try {
                        ui = new firebaseui.auth.AuthUI(authCompat);
                        uiRef.current = ui;
                        ui.start(containerRef.current, uiConfig);
                    } catch (retryErr) {
                        console.error('Error recreating and starting FirebaseUI:', retryErr);
                    }
                } else {
                    console.error('Error starting FirebaseUI:', err);
                }
            }
        }

        // Cleanup
        return () => {
            // Remove custom styles
            const styleElement = document.querySelector('style[data-firebaseui-recaptcha]');
            if (styleElement) {
                styleElement.remove();
            }
            
            // Check if this is a real unmount by verifying container is no longer in DOM
            if (uiRef.current && containerRef.current && !document.contains(containerRef.current)) {
                try {
                    uiRef.current.delete();
                } catch (err) {
                    // Ignore cleanup errors
                }
                uiRef.current = null;
            }
        };
    }, []); // Only run once on mount

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4 w-full">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-2xl p-6 w-full">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Strokes-N-Chokes</h1>
                        <p className="text-gray-600">Sign in with your phone number</p>
                    </div>
                    
                    {/* FirebaseUI container */}
                    <div 
                        id="firebaseui-auth-container" 
                        ref={containerRef}
                        className="w-full"
                        style={{ 
                            minHeight: '400px',
                            position: 'relative',
                            zIndex: 1
                        }}
                    ></div>
                    
                    {/* Additional reCAPTCHA container - FirebaseUI will use this if needed */}
                    <div id="recaptcha-container" style={{ 
                        marginTop: '10px',
                        display: 'flex',
                        justifyContent: 'center',
                        minHeight: '78px'
                    }}></div>
                    
                    {/* Just Login Link */}
                    <div className="mt-6 text-center border-t border-gray-200 pt-4">
                        <button
                            onClick={handleAnonymousLogin}
                            disabled={isSigningIn}
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSigningIn ? 'Signing in...' : 'Just Login'}
                        </button>
                        <p className="text-xs text-gray-500 mt-1">Skip verification and login directly</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginFirebaseUI;

