import React, { useState, useEffect, useRef } from 'react';
import { 
    signInWithPhoneNumber,
    RecaptchaVerifier
} from 'firebase/auth';

const Login = ({ auth, onLoginSuccess }) => {
    const [phoneNumber, setPhoneNumber] = useState('+1');
    const [verificationCode, setVerificationCode] = useState('');
    const [confirmationResult, setConfirmationResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState('phone'); // 'phone' or 'code'
    const recaptchaVerifierRef = useRef(null);
    const recaptchaContainerRef = useRef(null);
    const recaptchaSolvedRef = useRef(false); // Track if reCAPTCHA has been solved
    
    // Detect if we're in development (localhost)
    const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Detect if we're in Capacitor (Android/iOS app)
    const isCapacitor = window.Capacitor !== undefined;

    // Initialize reCAPTCHA verifier when component mounts
    useEffect(() => {
        if (!auth) return;
        
        // For localhost development, disable app verification to make testing easier
        // This makes reCAPTCHA auto-resolve. Only works with test phone numbers.
        // See: https://firebase.google.com/docs/auth/web/phone-auth#testing
        // Note: This requires 'localhost' to be added to Firebase Console → Authentication → Settings → Authorized domains
        if (isDevelopment) {
            try {
                // In modular SDK, settings might be accessed differently
                // Try both the old namespaced way and the modular way
                if (auth.settings) {
                    auth.settings.appVerificationDisabledForTesting = false;
                    console.log('Development mode: App verification disabled for testing');
                } else if (auth._delegate && auth._delegate.settings) {
                    auth._delegate.settings.appVerificationDisabledForTesting = false;
                    console.log('Development mode: App verification disabled for testing (via delegate)');
                } else {
                    console.warn('Could not access auth.settings. Make sure localhost is authorized in Firebase Console.');
                }
            } catch (err) {
                console.warn('Could not disable app verification for testing:', err);
                console.warn('Make sure localhost is added to Firebase Console → Authentication → Settings → Authorized domains');
            }
        }

        // Note: We DON'T initialize reCAPTCHA here to prevent re-render issues
        // reCAPTCHA is initialized on-demand when user submits the form
        // This ensures the container element is stable and not recreated by React
        
        // Clean up on unmount
        return () => {
            if (recaptchaVerifierRef.current) {
                try {
                    recaptchaVerifierRef.current.clear();
                } catch (err) {
                    // Ignore cleanup errors
                }
                recaptchaVerifierRef.current = null;
            }
            recaptchaSolvedRef.current = false;
        };
    }, [auth, isDevelopment]);

    const initializeRecaptcha = async () => {
        // Clear existing verifier if any
        if (recaptchaVerifierRef.current) {
            try {
                recaptchaVerifierRef.current.clear();
            } catch (err) {
                // Ignore cleanup errors
            }
            recaptchaVerifierRef.current = null;
        }

        // Wait for DOM to be ready and ensure container exists
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify container exists and is stable (not being recreated by React)
        const container = document.getElementById('recaptcha-container');
        if (!container) {
            throw new Error('reCAPTCHA container not found. Please refresh the page.');
        }
        
        // Clear container only if it's safe to do so (no existing widget)
        // Don't clear if React might be re-rendering
        if (container.children.length === 0) {
            container.innerHTML = '';
        }
        
        try {
            // Use invisible reCAPTCHA for production and Android (better for WebView)
            // Use visible reCAPTCHA only for localhost web development
            const recaptchaSize = (isDevelopment && !isCapacitor) ? 'normal' : 'invisible';
            
            console.log('Initializing reCAPTCHA:', { size: recaptchaSize, isDevelopment, isCapacitor });
            
            recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
                size: recaptchaSize,
                callback: (response) => {
                    // reCAPTCHA solved - mark it as solved
                    recaptchaSolvedRef.current = true;
                    console.log('reCAPTCHA callback fired - solved!', response ? 'Response token received' : 'No response token');
                    console.log('Response details:', response);
                },
                'expired-callback': () => {
                    recaptchaSolvedRef.current = false;
                    console.warn('reCAPTCHA expired');
                    setError('Verification expired. Please try again.');
                    if (recaptchaVerifierRef.current) {
                        try {
                            recaptchaVerifierRef.current.clear();
                        } catch (err) {
                            // Ignore
                        }
                        recaptchaVerifierRef.current = null;
                    }
                }
            });
            
            // Render the reCAPTCHA and wait for it to complete
            console.log('Rendering reCAPTCHA...');
            const widgetId = await recaptchaVerifierRef.current.render();
            console.log('reCAPTCHA rendered successfully, widget ID:', widgetId);
            
            // For invisible reCAPTCHA, we MUST call verify() to get the token
            // The callback will fire when it's solved, giving us the token
            if (recaptchaSize === 'invisible') {
                console.log('Invisible reCAPTCHA - calling verify() to get token...');
                // For invisible, verify() triggers the verification and callback
                // We need to wait for the callback to fire before proceeding
                try {
                    await recaptchaVerifierRef.current.verify();
                    console.log('reCAPTCHA verify() completed');
                } catch (verifyErr) {
                    // verify() might resolve immediately or throw, but callback should fire
                    console.log('verify() result:', verifyErr);
                }
            }
        } catch (err) {
            console.error('Error setting up reCAPTCHA:', err);
            throw new Error('Failed to initialize verification. Please refresh the page.');
        }
    };

    const formatPhoneNumber = (value) => {
        // Ensure it always starts with +1
        if (!value.startsWith('+1')) {
            // If user deletes everything, keep +1
            if (value === '' || value === '+') {
                return '+1';
            }
            // If it doesn't start with +, assume they want +1 prefix
            if (!value.startsWith('+')) {
                const digits = value.replace(/\D/g, '');
                value = '+1' + digits;
            }
        }
        
        // Remove all non-digit characters except the leading +
        const digits = value.replace(/\D/g, '');
        
        // Ensure it starts with 1 (country code)
        if (!digits.startsWith('1')) {
            return '+1';
        }
        
        // Format as +1 (XXX) XXX-XXXX for US numbers
        if (digits.length <= 1) {
            return '+1';
        } else if (digits.length <= 4) {
            return `+1 (${digits.slice(1)}`;
        } else if (digits.length <= 7) {
            return `+1 (${digits.slice(1, 4)}) ${digits.slice(4)}`;
        } else {
            return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
        }
    };

    const handlePhoneSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Format phone number (ensure it starts with +1)
            let formattedPhone = phoneNumber.replace(/\D/g, '');
            
            // Ensure it starts with 1 (US country code)
            if (!formattedPhone.startsWith('1')) {
                formattedPhone = '1' + formattedPhone;
            }
            
            // Add + prefix (E.164 format)
            formattedPhone = '+' + formattedPhone;
            
            // Validate minimum length (country code + area code + number)
            // E.164 format: +1XXXXXXXXXX (11 digits after +)
            if (formattedPhone.length !== 12) { // +1 + exactly 10 digits
                throw new Error('Please enter a valid 10-digit US phone number');
            }
            
            // Log for debugging
            console.log('Formatted phone number:', formattedPhone);

            // Always recreate reCAPTCHA for each attempt to avoid stale state
            recaptchaSolvedRef.current = false;
            
            // Clear any existing reCAPTCHA first
            if (recaptchaVerifierRef.current) {
                try {
                    recaptchaVerifierRef.current.clear();
                } catch (err) {
                    console.warn('Error clearing old reCAPTCHA:', err);
                }
                recaptchaVerifierRef.current = null;
            }
            
            // Clear the container element safely
            // Wait a moment to ensure any React re-renders have completed
            await new Promise(resolve => setTimeout(resolve, 50));
            
            const container = document.getElementById('recaptcha-container');
            if (!container) {
                throw new Error('reCAPTCHA container not found. Please refresh the page.');
            }
            
            // Only clear if we're sure it's safe (no active verifier)
            if (!recaptchaVerifierRef.current) {
                container.innerHTML = '';
            }
            
            // Initialize fresh reCAPTCHA
            await initializeRecaptcha();

            if (!recaptchaVerifierRef.current) {
                throw new Error('Verification not initialized. Please try again.');
            }
            
            // For visible reCAPTCHA, we need to wait for the user to solve it
            // For invisible reCAPTCHA, it should solve automatically
            const recaptchaSize = (isDevelopment && !isCapacitor) ? 'normal' : 'invisible';
            
            if (recaptchaSize === 'normal') {
                // Visible reCAPTCHA - wait for user to solve it
                console.log('Waiting for user to solve visible reCAPTCHA...');
                if (!recaptchaSolvedRef.current) {
                    // Wait up to 60 seconds for user to solve reCAPTCHA
                    let solved = false;
                    const maxWait = 60000; // 60 seconds
                    const checkInterval = 500; // Check every 500ms
                    const startTime = Date.now();
                    
                    while (!solved && (Date.now() - startTime) < maxWait) {
                        await new Promise(resolve => setTimeout(resolve, checkInterval));
                        solved = recaptchaSolvedRef.current;
                        if (solved) {
                            console.log('reCAPTCHA solved by user');
                            break;
                        }
                    }
                    
                    if (!solved) {
                        throw new Error('Please complete the reCAPTCHA verification before submitting.');
                    }
                }
            } else {
                // Invisible reCAPTCHA - we called verify() during initialization
                // Now we need to wait for the callback to fire to ensure we have a token
                console.log('Using invisible reCAPTCHA - waiting for callback to confirm token...');
                
                if (!recaptchaSolvedRef.current) {
                    // Wait up to 10 seconds for invisible reCAPTCHA callback to fire
                    let solved = false;
                    const maxWait = 10000; // 10 seconds
                    const checkInterval = 200; // Check every 200ms
                    const startTime = Date.now();
                    
                    while (!solved && (Date.now() - startTime) < maxWait) {
                        await new Promise(resolve => setTimeout(resolve, checkInterval));
                        solved = recaptchaSolvedRef.current;
                        if (solved) {
                            console.log('Invisible reCAPTCHA solved via callback - token ready');
                            break;
                        }
                    }
                    
                    if (!solved) {
                        console.error('Invisible reCAPTCHA callback never fired - token not available');
                        throw new Error('reCAPTCHA verification timed out. Please try again.');
                    }
                } else {
                    console.log('Invisible reCAPTCHA already solved - token ready');
                }
            }

            console.log('Calling signInWithPhoneNumber with:', {
                phone: formattedPhone,
                hasVerifier: !!recaptchaVerifierRef.current,
                verifierType: recaptchaVerifierRef.current?.constructor?.name
            });
            
            // Send verification code with reCAPTCHA verifier
            // For invisible reCAPTCHA, this will trigger the verification automatically
            const confirmation = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifierRef.current);
            console.log('signInWithPhoneNumber succeeded!');
            setConfirmationResult(confirmation);
            setStep('code');
            setLoading(false);
        } catch (err) {
            console.error('Phone authentication error:', err);
            console.error('Full error object:', JSON.stringify(err, null, 2));
            console.error('Error code:', err.code);
            console.error('Error message:', err.message);
            console.error('Error stack:', err.stack);
            
            let errorMessage = 'Failed to send verification code. Please try again.';
            
            if (err.code === 'auth/invalid-phone-number') {
                errorMessage = 'Invalid phone number. Please check and try again.';
            } else if (err.code === 'auth/too-many-requests') {
                errorMessage = 'Too many verification attempts. Please wait a few minutes before trying again. Firebase limits the number of SMS codes you can request to prevent abuse.';
            } else if (err.code === 'auth/quota-exceeded') {
                errorMessage = 'SMS quota exceeded. Please try again later or contact support if this persists.';
            } else if (err.code === 'auth/captcha-check-failed') {
                // Check if it's a MALFORMED error specifically
                if (err.message && err.message.includes('MALFORMED')) {
                    errorMessage = 'reCAPTCHA verification failed. Please complete the reCAPTCHA checkbox and try again. If the problem persists, refresh the page.';
                } else {
                    errorMessage = 'reCAPTCHA verification failed. Please make sure "localhost" is added to Firebase Console → Authentication → Settings → Authorized domains, then refresh the page and try again.';
                }
                // Reset reCAPTCHA on failure
                recaptchaSolvedRef.current = false;
                if (recaptchaVerifierRef.current) {
                    try {
                        recaptchaVerifierRef.current.clear();
                    } catch (clearErr) {
                        // Ignore
                    }
                    recaptchaVerifierRef.current = null;
                }
            } else if (err.code === 'auth/argument-error') {
                errorMessage = 'Invalid phone number format. Please include country code (e.g., +1 for US).';
            } else if (err.code === 'auth/invalid-app-credential' || (err.message && err.message.includes('INVALID_APP_CREDENTIAL'))) {
                if (isCapacitor) {
                    errorMessage = 'App verification failed (Android). Please ensure: 1) SHA-1 fingerprint is added to Firebase Console, 2) Updated google-services.json is downloaded, 3) App is rebuilt. See FIX_INVALID_APP_CREDENTIAL.md for details.';
                } else {
                    errorMessage = 'App verification failed (Web). Please ensure: 1) "localhost" is added to Firebase Console → Authentication → Settings → Authorized domains, 2) API key allows localhost. See FIX_INVALID_APP_CREDENTIAL.md for details.';
                }
            } else if (err.message && err.message.includes('400')) {
                errorMessage = 'Invalid request. Please check your phone number format and try again. If the problem persists, refresh the page.';
            } else if (err.code === 'auth/internal-error') {
                errorMessage = 'Internal error. Please refresh the page and try again.';
                // Reset reCAPTCHA on internal error
                if (recaptchaVerifierRef.current) {
                    try {
                        recaptchaVerifierRef.current.clear();
                    } catch (clearErr) {
                        // Ignore
                    }
                    recaptchaVerifierRef.current = null;
                }
            } else if (err.message) {
                errorMessage = err.message;
            }
            
            setError(errorMessage);
            setLoading(false);
        }
    };

    const handleCodeSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (!confirmationResult) {
                throw new Error('No verification code sent. Please start over.');
            }

            // Verify the code
            await confirmationResult.confirm(verificationCode);
            onLoginSuccess();
        } catch (err) {
            console.error('Code verification error:', err);
            let errorMessage = 'Invalid verification code. Please try again.';
            
            if (err.code === 'auth/invalid-verification-code') {
                errorMessage = 'Invalid code. Please check and try again.';
            } else if (err.code === 'auth/code-expired') {
                errorMessage = 'Verification code expired. Please request a new code.';
            } else if (err.message) {
                errorMessage = err.message;
            }
            
            setError(errorMessage);
            setLoading(false);
        }
    };

    const handleBackToPhone = () => {
        // Reset all state to start fresh
        setStep('phone');
        setPhoneNumber('+1'); // Reset to default
        setVerificationCode('');
        setError('');
        setConfirmationResult(null);
        setLoading(false);
        recaptchaSolvedRef.current = false; // Reset solved state
        // Clear reCAPTCHA - will be reinitialized on next submit
        if (recaptchaVerifierRef.current) {
            try {
                recaptchaVerifierRef.current.clear();
            } catch (err) {
                // Ignore cleanup errors
            }
            recaptchaVerifierRef.current = null;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4 w-full">
            <div className="w-full">
                <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl mx-auto">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Strokes-N-Chokes</h1>
                        <p className="text-gray-600">
                            {step === 'phone' 
                                ? 'Enter your phone number to continue' 
                                : 'Enter the verification code sent to your phone'}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {step === 'phone' ? (
                        <form onSubmit={handlePhoneSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-1">
                                    Phone Number
                                </label>
                                <input
                                    id="phone"
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                                    required
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-black"
                                    placeholder="(555) 123-4567"
                                    disabled={loading}
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Enter your 10-digit phone number (US)
                                </p>
                            </div>

                            {/* reCAPTCHA container - must be stable across re-renders */}
                            {/* Using key to prevent React from recreating it unnecessarily */}
                            <div 
                                id="recaptcha-container" 
                                ref={recaptchaContainerRef}
                                key="recaptcha-container"
                                style={{ minHeight: '1px' }}
                            ></div>

                            <button
                                type="submit"
                                disabled={loading || !phoneNumber}
                                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
                            >
                                {loading ? 'Sending code...' : 'Send Verification Code'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleCodeSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="code" className="block text-sm font-semibold text-gray-700 mb-1">
                                    Verification Code
                                </label>
                                <input
                                    id="code"
                                    type="text"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    required
                                    maxLength={6}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-black text-center text-2xl tracking-widest"
                                    placeholder="000000"
                                    disabled={loading}
                                    autoFocus
                                />
                                <p className="mt-1 text-xs text-gray-500 text-center">
                                    Enter the 6-digit code sent to {phoneNumber}
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || verificationCode.length !== 6}
                                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg"
                            >
                                {loading ? 'Verifying...' : 'Verify Code'}
                            </button>

                            <button
                                type="button"
                                onClick={handleBackToPhone}
                                disabled={loading}
                                className="w-full py-2 text-blue-600 hover:text-blue-700 font-medium text-sm disabled:opacity-50"
                            >
                                ← Back to phone number
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Login;
