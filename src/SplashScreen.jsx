import React, { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth as firebaseAuth } from './firebase';

const LOADING_MESSAGES = [
    "Warming up the shaft…",
    "Just a quick stroke while we load.",
    "Polishing the clubs, be right with you.",
    "Calibrating your choke settings…",
    "Finding someone to blame for your slice.",
    "Loading 18 holes of bad decisions.",
    "Hold on, we're teeing up your humiliation.",
    "Shanking the server connection… please wait.",
    "Gripping it and ripping it… almost ready.",
    "Trying to get it in the hole, stand by.",
    "Fore! …play is about to get rough.",
    "Relax, we're just lubing up the leaderboard.",
    "Balls deep in loading, give us a sec.",
    "Spitting on the grip for better control…",
    "Warming the hole so you don't three-putt life.",
    "Currently choking… please do not disturb.",
    "Sliding into your fairway, hang tight.",
    "One second, we're pulling out the big driver.",
    "If this takes longer than four hours, call a doctor.",
    "Just trimming the rough…",
    "Waxing the shaft, stand by.",
    "Loading your daily dose of bogey regret.",
    "Finding the sweet spot… almost there.",
    "Currently choking harder than you on the 18th.",
    "Greasing the pin for easier entry.",
    "Hold on, we're bending over to pick up your money.",
    "Shaking the trees for loose change.",
    "Teasing the hole, be patient.",
    "Calibrating your handicap (and your dignity).",
    "Spanking the server for being slow.",
    "Just a little fore-play…",
    "Pulling out the big wood.",
    "Making the green wet for you.",
    "Trying not to slice the database.",
    "Stretching the fairway, give us a sec.",
    "Polishing balls in the background.",
    "Currently yanking the driver.",
    "Adjusting your lie angle.",
    "Warming up the back nine.",
    "Slapping the bag, almost ready.",
    "Getting the head nice and shiny.",
    "Hold tight, we're topping it off.",
    "Finding the G-spot on the leaderboard.",
    "Loading your next bad bet.",
    "Rimming the cup… please wait.",
    "Just a quick tug on the flagstick.",
    "Lubricating the betting slip.",
    "Mounting the leaderboard, hang on.",
    "Giving the shaft a good stroke.",
    "Loading your future therapy bills.",
    "Blowing the leaves off the green.",
    "Taking the club nice and deep.",
    "Hold on, we're draining the snake.",
    "Greasing the wheels of your downfall.",
    "Spreading the fairway for maximum pleasure.",
    "Just the tip… of the iceberg of debt.",
    "Ramming it straight down the middle.",
    "Bending over to read the break.",
    "Slipping it in gently…",
    "Adjusting your stroke length.",
    "Making the hole beg for mercy.",
    "Loading your next \"I'm never betting again.\"",
    "Giving the shaft a happy ending.",
    "Currently penetrating the firewall.",
    "Hold on, we're pounding the dogleg.",
    "Smoothing out the divots… and your ego.",
    "Teasing the back door entry.",
    "Just a little rough stuff.",
    "Loading your mulligan addiction.",
    "Slapping it around the bunker.",
    "Warming up the 69 different ways.",
    "Currently riding the cart path hard.",
    "Taking a practice stroke or ten.",
    "Making the pin moan.",
    "Loading your future excuses.",
    "Giving the driver a reach-around.",
    "Hold tight, we're coming in low and hot.",
    "Stiffening the shaft.",
    "Loading your next \"I can't believe I bet that.\"",
    "Banging it off the hosel.",
    "Currently three-putting the server.",
    "Slamming it into the dance floor.",
    "Making the green swallow.",
    "Hold on, we're dropping a bomb.",
    "Nice and easy does it… never mind, ramming speed.",
    "Loading your next DUI on the 19th hole.",
    "Gripping it like your ex's lawyer.",
    "Currently blowing the leaves off your wallet.",
    "Taking the club to pound town.",
    "Loading your next \"fore!\" of shame.",
    "Shoving it in the short grass.",
    "Making the cup overflow.",
    "Beating it like it owes us money.",
    "Almost there… don't pull out yet."
];

const SplashScreen = ({ onAuthCheckComplete }) => {
    const startTime = useRef(Date.now());
    const MIN_DISPLAY_TIME = 1000; // Minimum 1 second display
    const authChecked = useRef(false);
    const [loadingMessage, setLoadingMessage] = useState(() => {
        // Randomly select initial message
        return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
    });

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

    // Cycle through loading messages every 2 seconds
    useEffect(() => {
        const messageInterval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * LOADING_MESSAGES.length);
            setLoadingMessage(LOADING_MESSAGES[randomIndex]);
        }, 2000); // Change message every 2 seconds

        return () => clearInterval(messageInterval);
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
                            marginTop: '16px',
                            minHeight: '20px',
                            transition: 'opacity 0.3s ease-in-out'
                        }}
                    >
                        {loadingMessage}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SplashScreen;
