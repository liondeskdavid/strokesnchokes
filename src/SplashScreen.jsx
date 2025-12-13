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

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
            <div className="text-center">
                {/* Logo */}
                <div className="flex justify-center mb-6">
                    <img 
                        src="/icon.png" 
                        alt="Strokes-N-Chokes Logo" 
                        className="w-32 h-32 object-contain animate-pulse"
                        onError={(e) => {
                            // Fallback if icon doesn't load
                            e.target.style.display = 'none';
                        }}
                    />
                </div>
                
                {/* App Name */}
                <h1 className="text-4xl font-extrabold text-gray-900 mb-2">
                    Strokes-N-Chokes
                </h1>
                
                {/* Loading indicator */}
                <div className="mt-6">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-gray-600 text-sm">Loading...</p>
                </div>
            </div>
        </div>
    );
};

export default SplashScreen;
