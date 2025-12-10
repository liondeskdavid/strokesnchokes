import React, { useState, useEffect, useRef } from 'react';
import { 
    signInWithPhoneNumber,
    RecaptchaVerifier
} from 'firebase/auth';

const Login = ({ auth, onLoginSuccess }) => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [confirmationResult, setConfirmationResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState('phone'); // 'phone' or 'code'
    const recaptchaVerifierRef = useRef(null);
    const recaptchaContainerRef = useRef(null);

    // Initialize reCAPTCHA verifier when component mounts
    useEffect(() => {
        if (!auth) return;

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
        };
    }, [auth]);

    const initializeRecaptcha = () => {
        // Clear existing verifier if any
        if (recaptchaVerifierRef.current) {
            try {
                recaptchaVerifierRef.current.clear();
            } catch (err) {
                // Ignore cleanup errors
            }
            recaptchaVerifierRef.current = null;
        }

        // Wait for DOM to be ready
        setTimeout(() => {
            try {
                recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
                    size: 'invisible', // Use invisible reCAPTCHA
                    callback: () => {
                        // reCAPTCHA solved automatically
                    },
                    'expired-callback': () => {
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
                // Render the invisible reCAPTCHA
                recaptchaVerifierRef.current.render().catch((err) => {
                    console.error('reCAPTCHA render error:', err);
                    setError('Failed to initialize verification. Please refresh the page.');
                });
            } catch (err) {
                console.error('Error setting up reCAPTCHA:', err);
                setError('Failed to initialize verification. Please refresh the page.');
            }
        }, 100);
    };

    const formatPhoneNumber = (value) => {
        // Remove all non-digit characters
        const digits = value.replace(/\D/g, '');
        
        // Format as +1 (XXX) XXX-XXXX for US numbers
        if (digits.length <= 1) {
            return digits ? `+${digits}` : '';
        } else if (digits.length <= 4) {
            return `+${digits.slice(0, 1)} (${digits.slice(1)}`;
        } else if (digits.length <= 7) {
            return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4)}`;
        } else {
            return `+${digits.slice(0, 1)} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
        }
    };

    const handlePhoneSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Format phone number (ensure it starts with + and country code)
            let formattedPhone = phoneNumber.replace(/\D/g, '');
            if (!formattedPhone.startsWith('1') && formattedPhone.length === 10) {
                // Assume US number if 10 digits without country code
                formattedPhone = '1' + formattedPhone;
            }
            if (!formattedPhone.startsWith('+')) {
                formattedPhone = '+' + formattedPhone;
            }

            // Initialize reCAPTCHA if not already initialized
            if (!recaptchaVerifierRef.current) {
                initializeRecaptcha();
                // Wait a moment for reCAPTCHA to initialize
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (!recaptchaVerifierRef.current) {
                throw new Error('Verification not initialized. Please try again.');
            }

            // Send verification code with reCAPTCHA verifier
            // The invisible reCAPTCHA will be solved automatically
            const confirmation = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifierRef.current);
            setConfirmationResult(confirmation);
            setStep('code');
            setLoading(false);
        } catch (err) {
            console.error('Phone authentication error:', err);
            let errorMessage = 'Failed to send verification code. Please try again.';
            
            if (err.code === 'auth/invalid-phone-number') {
                errorMessage = 'Invalid phone number. Please check and try again.';
            } else if (err.code === 'auth/too-many-requests') {
                errorMessage = 'Too many requests. Please try again later.';
            } else if (err.code === 'auth/captcha-check-failed') {
                errorMessage = 'Verification failed. Please try again.';
                // Reset reCAPTCHA on failure
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
        setStep('phone');
        setVerificationCode('');
        setError('');
        setConfirmationResult(null);
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
        <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-2xl p-6">
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
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                                    placeholder="+1 (555) 123-4567"
                                    disabled={loading}
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Include country code (e.g., +1 for US)
                                </p>
                            </div>

                            {/* Invisible reCAPTCHA container */}
                            <div id="recaptcha-container" ref={recaptchaContainerRef} style={{ display: 'none' }}></div>

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
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-center text-2xl tracking-widest"
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
