import React, { useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth as firebaseAuth } from './firebase';

const SplashScreen = ({ onAuthCheckComplete }) => {
    const startTime = useRef(Date.now());
    const MIN_DISPLAY_TIME = 1000; // Minimum 1 second display
    const authChecked = useRef(false);

    useEffect(() => {
        let authUnsubscribe = null;
        let minTimeTimer = null;

        // Check authentication state
        authUnsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
            authChecked.current = true;
            const elapsed = Date.now() - startTime.current;
            const remainingTime = Math.max(0, MIN_DISPLAY_TIME - elapsed);
            
            // Wait for minimum display time, then complete
            minTimeTimer = setTimeout(() => {
                onAuthCheckComplete(!!user);
            }, remainingTime);
        });

        // Cleanup
        return () => {
            if (authUnsubscribe) authUnsubscribe();
            if (minTimeTimer) clearTimeout(minTimeTimer);
        };
    }, [onAuthCheckComplete]);

    // Set body background to white when splash screen is mounted
    useEffect(() => {
        const originalBodyBg = document.body.style.backgroundColor;
        const originalHtmlBg = document.documentElement.style.backgroundColor;
        document.body.style.backgroundColor = '#ffffff';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.documentElement.style.backgroundColor = '#ffffff';
        document.documentElement.style.margin = '0';
        document.documentElement.style.padding = '0';
        
        return () => {
            document.body.style.backgroundColor = originalBodyBg;
            document.documentElement.style.backgroundColor = originalHtmlBg;
        };
    }, []);

    return (
        <div 
            className="min-h-screen bg-white flex items-center justify-center"
            style={{ 
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw', 
                height: '100vh',
                minHeight: '100vh',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                margin: 0,
                padding: 0,
                overflow: 'hidden',
                zIndex: 9999
            }}
        >
            <div 
                className="text-center w-full px-4"
                style={{ 
                    width: '100%', 
                    maxWidth: '100%',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                    padding: '0 16px'
                }}
            >
                {/* Logo */}
                <div 
                    className="mb-6"
                    style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        width: '100%',
                        marginBottom: '24px'
                    }}
                >
                    <img 
                        src="/icon.png" 
                        alt="Strokes-N-Chokes Logo" 
                        className="w-32 h-32 object-contain animate-pulse"
                        style={{ 
                            display: 'block',
                            margin: '0 auto',
                            width: '128px',
                            height: '128px'
                        }}
                        onError={(e) => {
                            // Fallback if icon doesn't load
                            e.target.style.display = 'none';
                        }}
                    />
                </div>
                
                {/* App Name */}
                <h1 
                    className="text-4xl font-extrabold text-gray-900 mb-2"
                    style={{ 
                        textAlign: 'center',
                        width: '100%',
                        margin: '0 auto 8px auto',
                        color: '#111827'
                    }}
                >
                    Strokes-N-Chokes
                </h1>
                
                {/* Loading indicator */}
                <div 
                    className="mt-6"
                    style={{ 
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        marginTop: '24px'
                    }}
                >
                    <div 
                        className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
                        style={{ 
                            margin: '0 auto',
                            width: '32px',
                            height: '32px',
                            borderWidth: '2px',
                            borderColor: '#2563eb',
                            borderTopColor: 'transparent',
                            borderRadius: '50%'
                        }}
                    ></div>
                    <p 
                        className="mt-4 text-gray-600 text-sm"
                        style={{ 
                            textAlign: 'center', 
                            width: '100%',
                            color: '#4b5563',
                            marginTop: '16px'
                        }}
                    >
                        Loading...
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SplashScreen;
