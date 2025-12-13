import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
    collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
    serverTimestamp, query, where, getDocs, getDoc, setDoc,
} from 'firebase/firestore';
import { auth as firebaseAuth, db as firestoreDb } from './firebase';
import Courses from './Courses';
import Login from './Login';
import LoginFirebaseUI from './LoginFirebaseUI';
import SplashScreen from './SplashScreen';

// SIMPLE, WORKING PATHS — THIS IS ALL YOU NEED
const getPlayerCollectionPath = (userId) => `users/${userId}/players`;
const getRoundCollectionPath = (userId) => `users/${userId}/rounds`;
const getBetCollectionPath = (userId) => `users/${userId}/custom_bets`;  // Fixed: was missing!
const getCourseCollectionPath = (userId) => `users/${userId}/courses`;
const getUserDocumentPath = (userId) => `users/${userId}`;
const SHARED_ROUNDS_COLLECTION = 'shared_rounds'; // Collection for mapping share codes to rounds

// --- Constants ---
const NUM_HOLES = 18;
const BET_TYPES = ['Side Bet', 'Nassau', 'Skins', 'Match Play', '9 Point', 'Low Ball/High Ball (Not Active)'];
const JUNK_TYPES = [
    { id: 'greenies', name: 'Greenies', description: 'Closest to pin on par 3', points: 1 },
    { id: 'sandies', name: 'Sandies', description: 'Up-and-down from greenside bunker', points: 1 },
    { id: 'poleys', name: 'Poleys', description: 'Putt longer than flagstick height', points: 1 },
    { id: 'gainingDots', name: 'Gaining Dots', description: 'Birdies, chip-ins, long putts', points: 1 },
    { id: 'losingDots', name: 'Losing Dots', description: 'Bunker, water hazard, OB', points: 1 }
];
const HOLE_NUMBERS = Array.from({ length: NUM_HOLES }, (_, i) => i + 1);

// --- Utility Functions ---

/**
 * Generate a 4-character alphanumeric share code
 */
const generateShareCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

/**
 * Handles error logging and displays a simple message to the user.
 * @param {string} message
 * @param {Error} error
 */
const handleError = (message, error) => {
    console.error(message, error);
};

/**
 * Calculates the number of handicap strokes a player receives on a specific hole.
 */
const getHandicapStrokesForIndex = (courseHandicap, holeIndex) => {
    const N = parseInt(courseHandicap, 10) || 0;
    const absN = Math.abs(N);

    let totalStrokes = 0;
    let tempHCP = absN;

    while (tempHCP > 0) {
        if (holeIndex <= Math.min(tempHCP, NUM_HOLES)) {
            totalStrokes++;
        }
        tempHCP -= NUM_HOLES;
    }

    return N < 0 ? totalStrokes * -1 : totalStrokes;
};

// --- Initial Data Generator ---
const generateDefaultHoleData = () => {
    const defaultData = {};
    for (let i = 1; i <= NUM_HOLES; i++) {
        let par = 4;
        if ([3, 7, 12, 16].includes(i)) par = 3;
        if ([5, 9, 14, 18].includes(i)) par = 5;

        defaultData[`hole${i}`] = {
            par: par,
            index: i,
        };
    }
    return defaultData;
};

// --- Child Components ---

const PlayerManager = ({
    dbReady,
    newPlayerFirstName,
    setNewPlayerFirstName,
    newPlayerLastName,
    setNewPlayerLastName,
    newPlayerHandicap,
    setNewPlayerHandicap,
    handleAddPlayer,
    players,
    selectedExistingPlayerId,
    setSelectedExistingPlayerId,
    roundPlayerIds,
    setRoundPlayerIds,
    myPlayerId,
}) => {
    // Helper to parse name into first and last
    const parseName = (fullName) => {
        const parts = (fullName || '').trim().split(/\s+/);
        if (parts.length >= 2) {
            return { first: parts[0], last: parts.slice(1).join(' ') };
        } else if (parts.length === 1) {
            return { first: parts[0], last: '' };
        }
        return { first: '', last: '' };
    };

    return (
        <div className="p-3 bg-white rounded-2xl shadow-xl border-2 border-blue-200">
            <h2 className="text-lg font-bold text-blue-800 mb-2">Select Players</h2>
            
            {/* Select existing player or enter a new one */}
            <div className="mb-3">
              
                <select
                    value={selectedExistingPlayerId}
                    onChange={(e) => {
                        const selectedId = e.target.value;
                        setSelectedExistingPlayerId(selectedId);
                        if (selectedId) {
                            const existing = players.find(p => p.id === selectedId);
                            if (existing) {
                                const nameParts = parseName(existing.name || '');
                                setNewPlayerFirstName(nameParts.first);
                                setNewPlayerLastName(nameParts.last);
                                setNewPlayerHandicap(
                                    typeof existing.handicap === 'number'
                                        ? String(existing.handicap)
                                        : (existing.handicap || '')
                                );
                            }
                        }
                    }}
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="">-- Select Player --</option>
                    {players.map(player => (
                        <option key={player.id} value={player.id}>
                            {player.name} (HCP {player.handicap ?? 0})
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex space-x-2 mb-4">
                <input
                    type="text"
                    placeholder="First Name"
                    value={newPlayerFirstName}
                    onChange={(e) => setNewPlayerFirstName(e.target.value)}
                    className="flex-1 min-w-0 max-w-28 p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <input
                    type="text"
                    placeholder="Last Name"
                    value={newPlayerLastName}
                    onChange={(e) => setNewPlayerLastName(e.target.value)}
                    className="flex-1 min-w-0 max-w-28 p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <input
                    type="number"
                    placeholder="HCP"
                    value={newPlayerHandicap}
                    onChange={(e) => setNewPlayerHandicap(e.target.value)}
                    className="w-16 p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    min="-54" max="54"
                />
                <button
                    onClick={handleAddPlayer}
                    className="px-3 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition duration-150 shadow-md disabled:opacity-50 text-sm"
                    disabled={!dbReady || !newPlayerFirstName.trim()}
                >
                    Add
                </button>
            </div>
            <div className="space-y-2 mt-1">
            {players.length === 0 ? (
                <p className="text-gray-500 italic p-2 bg-gray-50 rounded">
                    Add player names here before starting a round.
                </p>
            ) : (
                players
                    .filter(player => roundPlayerIds.includes(player.id))
                    .map(player => (
                        <div key={player.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-700">
                                    {player.name} (HCP: {player.handicap || 0})
                                </span>
                                {myPlayerId === player.id && (
                                    <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded font-semibold">Me</span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setRoundPlayerIds(prev => prev.filter(id => id !== player.id));
                                }}
                                className="px-2 py-1 text-xs font-medium rounded-lg border bg-white text-red-600 border-red-400 hover:bg-red-50"
                            >
                                Remove from round
                            </button>
                        </div>
                    ))
            )}
            {players.length > 0 && roundPlayerIds.length === 0 && (
                <p className="text-[11px] text-gray-500 mt-1">
                    No players currently in this round. Use the <span className="font-semibold">Saved Players</span> dropdown above to add players.
                </p>
            )}
            </div>
        </div>
    );
};

const TeamsManager = ({
    dbReady,
    teamMode,
    setTeamMode,
    teams,
    setTeams,
    players,
    roundPlayerIds
}) => {
    const addTeam = () => {
        const newTeam = {
            id: `team_${Date.now()}`,
            name: '',
            playerIds: []
        };
        setTeams([...teams, newTeam]);
    };

    const removeTeam = (teamId) => {
        setTeams(teams.filter(t => t.id !== teamId));
    };

    const updateTeamName = (teamId, name) => {
        setTeams(teams.map(t => t.id === teamId ? { ...t, name } : t));
    };

    const updateTeamPlayers = (teamId, playerIds) => {
        setTeams(teams.map(t => t.id === teamId ? { ...t, playerIds } : t));
    };

    const togglePlayerInTeam = (teamId, playerId) => {
        const team = teams.find(t => t.id === teamId);
        if (!team) return;
        
        const isSelected = team.playerIds.includes(playerId);
        if (isSelected) {
            // Remove player from team
            updateTeamPlayers(teamId, team.playerIds.filter(id => id !== playerId));
        } else {
            // Add player to team
            updateTeamPlayers(teamId, [...team.playerIds, playerId]);
        }
    };

    const availablePlayers = players.filter(p => roundPlayerIds.includes(p.id));

    return (
        <div className="p-3 bg-white rounded-2xl shadow-xl border-2 border-blue-200">
            <h2 className="text-lg font-bold text-blue-800 mb-2">Teams</h2>
            
            <div className="mb-3">
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Game Mode
                </label>
                <select
                    value={teamMode}
                    onChange={(e) => {
                        setTeamMode(e.target.value);
                        if (e.target.value === 'singles') {
                            setTeams([]);
                        }
                    }}
                    className="w-full p-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="singles">Singles (Individual Play)</option>
                    <option value="teams">Teams</option>
                </select>
            </div>

            {teamMode === 'teams' && (
                <div className="space-y-3">
                    {teams.map(team => (
                        <div key={team.id} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center space-x-2 mb-2">
                                <input
                                    type="text"
                                    placeholder="Team Name"
                                    value={team.name}
                                    onChange={(e) => updateTeamName(team.id, e.target.value)}
                                    className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                                <button
                                    onClick={() => removeTeam(team.id)}
                                    className="px-2 py-1 text-xs font-medium rounded-lg border bg-white text-red-600 border-red-400 hover:bg-red-50"
                                >
                                    Remove
                                </button>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-2">
                                    Select Players
                                </label>
                                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-white">
                                    {availablePlayers.length === 0 ? (
                                        <p className="text-xs text-gray-500 italic text-center py-2">
                                            No players available. Add players to the round first.
                                        </p>
                                    ) : (
                                        availablePlayers.map(player => {
                                            const isSelected = team.playerIds.includes(player.id);
                                            return (
                                                <label
                                                    key={player.id}
                                                    className="flex items-center space-x-2 p-2 rounded-lg hover:bg-blue-100 cursor-pointer transition-colors"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => togglePlayerInTeam(team.id, player.id)}
                                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                    />
                                                    <span className={`text-sm flex-1 ${isSelected ? 'font-semibold text-blue-700' : 'text-gray-700'}`}>
                                                        {player.name}
                                                    </span>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addTeam}
                        className="w-full px-3 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition duration-150 shadow-md text-sm"
                        disabled={!dbReady}
                    >
                        + Add Team
                    </button>
                    {teams.length === 0 && (
                        <p className="text-xs text-gray-500 italic text-center py-2">
                            Add teams to organize players
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

const ManagePlayers = ({
    dbReady,
    players,
    handleDeletePlayer,
    editingPlayerId,
    setEditingPlayerId,
    editingPlayerFirstName,
    setEditingPlayerFirstName,
    editingPlayerLastName,
    setEditingPlayerLastName,
    editingPlayerHandicap,
    setEditingPlayerHandicap,
    handleEditPlayer,
    handleSaveEditedPlayer,
    myPlayerId,
    handleSetMePlayer,
}) => {
    const [playerToDelete, setPlayerToDelete] = useState(null);
    
    // Helper to parse name into first and last
    const parseName = (fullName) => {
        const parts = (fullName || '').trim().split(/\s+/);
        if (parts.length >= 2) {
            return { first: parts[0], last: parts.slice(1).join(' ') };
        } else if (parts.length === 1) {
            return { first: parts[0], last: '' };
        }
        return { first: '', last: '' };
    };

    return (
        <div className="p-5 bg-white rounded-2xl shadow-xl border-2 border-blue-200 w-full">
            <div className="mb-4">
                <h2 className="text-lg font-bold text-blue-800">Manage Players</h2>
                <p className="text-sm text-gray-500 mt-1">
                    {players.length} player{players.length !== 1 ? 's' : ''} saved
                </p>
            </div>

            <div className="space-y-3">
                    <p className="text-xs text-gray-600 mb-2">
                        This list is saved to your account. Deleting a player here removes them from the saved list, but does not change historical rounds.
                    </p>
                    {players.length === 0 ? (
                        <p className="text-gray-500 italic p-3 bg-gray-50 rounded text-sm text-center">
                            No players saved yet. Add players using the form above.
                        </p>
                    ) : (
                        <div className="space-y-2 max-h-52 overflow-y-auto">
                            {[...players].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(player => {
                                const isEditing = editingPlayerId === player.id;
                                
                                return (
                                    <div key={player.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        {!isEditing ? (
                                            // View Mode
                                            <div className="flex justify-between items-center">
                                                <span className="font-medium text-gray-700">
                                                    {player.name} (HCP: {player.handicap || 0})
                                                </span>
                                                <div className="flex items-center space-x-2">
                                                    <button
                                                        onClick={() => handleSetMePlayer(player.id)}
                                                        disabled={!dbReady}
                                                        className={`px-2 py-1 text-xs font-medium rounded-lg transition duration-150 disabled:opacity-50 ${
                                                            myPlayerId === player.id
                                                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                        }`}
                                                    >
                                                        {myPlayerId === player.id ? 'Me ✓' : 'Me'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditPlayer(player.id)}
                                                        disabled={!dbReady}
                                                        className="px-3 py-1 bg-gray-500 text-white text-xs font-medium rounded-lg hover:bg-gray-600 transition duration-150 disabled:opacity-50"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => setPlayerToDelete({ id: player.id, name: player.name })}
                                                        disabled={!dbReady}
                                                        className="px-3 py-1 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition duration-150 disabled:opacity-50"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            // Edit Mode
                                            <div className="space-y-3">
                                                <div className="flex space-x-2">
                                                    <input
                                                        type="text"
                                                        placeholder="First Name"
                                                        value={editingPlayerFirstName}
                                                        onChange={(e) => setEditingPlayerFirstName(e.target.value)}
                                                        className="flex-1 min-w-0 p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Last Name"
                                                        value={editingPlayerLastName}
                                                        onChange={(e) => setEditingPlayerLastName(e.target.value)}
                                                        className="flex-1 min-w-0 p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                                                    />
                                                    <input
                                                        type="number"
                                                        placeholder="HCP"
                                                        value={editingPlayerHandicap}
                                                        onChange={(e) => setEditingPlayerHandicap(e.target.value)}
                                                        className="w-20 p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                                                        min="-54"
                                                        max="54"
                                                    />
                                                </div>
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={handleSaveEditedPlayer}
                                                        disabled={!dbReady || !editingPlayerFirstName.trim()}
                                                        className="flex-1 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition duration-150 disabled:opacity-50"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingPlayerId(null)}
                                                        className="flex-1 px-4 py-2 bg-gray-500 text-white text-xs font-medium rounded-lg hover:bg-gray-600 transition duration-150"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            
            {/* Delete Player Confirmation Modal */}
            {playerToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border-2 border-red-200 max-w-md w-full p-6">
                        <div className="flex items-center justify-center mb-4">
                            <div className="bg-red-100 rounded-full p-3">
                                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 text-center mb-2">Delete Player?</h3>
                        <p className="text-gray-600 text-center mb-6">
                            Are you sure you want to delete <span className="font-semibold text-gray-800">"{playerToDelete.name}"</span>? 
                            This action cannot be undone.
                        </p>
                        <div className="flex space-x-3">
                            <button
                                onClick={() => setPlayerToDelete(null)}
                                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition duration-150"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    handleDeletePlayer(playerToDelete.id);
                                    setPlayerToDelete(null);
                                }}
                                className="flex-1 px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition duration-150 shadow-md"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const AccountFunding = ({ dbReady }) => {
    const [fundAmount, setFundAmount] = useState('');
    const [accountBalance, setAccountBalance] = useState(0.00); // Placeholder balance

    const handleAddFunds = () => {
        // Placeholder - will be implemented later
        alert('Account funding feature coming soon!');
    };

    return (
        <div className="p-5 bg-white rounded-2xl shadow-xl border-2 border-blue-200 w-full">
            <div className="mb-4">
                <h2 className="text-lg font-bold text-blue-800">Account Funding</h2>
                <p className="text-sm text-gray-500 mt-1">
                    Add money to your account
                </p>
            </div>

            <div className="space-y-4">
                {/* Current Balance Display */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border-2 border-blue-200">
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600">Current Balance:</span>
                        <span className="text-2xl font-bold text-blue-800">
                            ${accountBalance.toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* Add Funds Form */}
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Amount to Add
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
                                $
                            </span>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={fundAmount}
                                onChange={(e) => setFundAmount(e.target.value)}
                                min="0"
                                step="0.01"
                                className="w-full pl-8 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-medium"
                                disabled={!dbReady}
                            />
                        </div>
                    </div>

                    {/* Quick Amount Buttons */}
                    <div className="grid grid-cols-4 gap-2">
                        {[25, 50, 100, 200].map((amount) => (
                            <button
                                key={amount}
                                onClick={() => setFundAmount(amount.toString())}
                                disabled={!dbReady}
                                className="px-3 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition duration-150 disabled:opacity-50 text-sm"
                            >
                                ${amount}
                            </button>
                        ))}
                    </div>

                    {/* Add Funds Button */}
                    <button
                        onClick={handleAddFunds}
                        disabled={!dbReady || !fundAmount || parseFloat(fundAmount) <= 0}
                        className="w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                        Add Funds
                    </button>
                </div>

                {/* Placeholder Notice */}
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-800 text-center">
                        ⚠️ Payment processing coming soon. This is a placeholder feature.
                    </p>
                </div>
            </div>
        </div>
    );
};

const CustomBetManager = ({
    dbReady,
    newBetName,
    setNewBetName,
    newBetType,
    setNewBetType,
    newBetAmount,
    setNewBetAmount,
    newBetCarryOver,
    setNewBetCarryOver,
    handleAddBet,
    customBets,
    handleDeleteBet,
    betError
}) => (
    <div className="p-5 bg-white rounded-2xl shadow-xl border-2 border-blue-200">
        <h2 className="text-lg font-bold text-blue-800 mb-2">Select Your Game and Bets</h2>

        {betError && (
             <div className="p-3 mb-4 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm font-medium">
                Error adding bet: {betError.message || betError.toString()}
             </div>
        )}

        <div className="space-y-3 mb-4">
            <select
                value={newBetType}
                onChange={(e) => {
                    setNewBetType(e.target.value);
                    // Auto-fill name for non-Side Bet types, clear for Side Bet
                    if (e.target.value !== 'Side Bet') {
                        setNewBetName(e.target.value);
                    } else {
                        setNewBetName('');
                    }
                }}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
                {BET_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                ))}
            </select>
            {newBetType === 'Side Bet' && (
                <input
                    type="text"
                    placeholder="Bet Name (e.g., First Birdie)"
                    value={newBetName}
                    onChange={(e) => setNewBetName(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
            )}
            <div className="flex space-x-2">
                <input
                    type="number"
                    placeholder={newBetType === 'Nassau' ? "$ Per Side" : newBetType === '9 Point' ? "$ Per Point" : "$ Amount"}
                    value={newBetAmount}
                    onChange={(e) => setNewBetAmount(e.target.value)}
                    className="w-28 p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    min="0"
                />
                <button
                    onClick={handleAddBet}
                    className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition duration-150 shadow-md disabled:opacity-50"
                    disabled={!dbReady || (newBetType === 'Side Bet' && !newBetName.trim()) || !newBetAmount}
                >
                    Add
                </button>
            </div>
            {newBetType === 'Nassau' && (
                <p className="text-xs text-gray-600 mt-1">
                    Nassau creates 3 bets: Front 9, Back 9, and Total. Amount is per side (e.g., $1 = $3 total).
                </p>
            )}
            {newBetType === '9 Point' && (
                <p className="text-xs text-gray-600 mt-1">
                    9 Point is a 3-player game where 9 points are split per hole based on net scores. Requires exactly 3 players.
                </p>
            )}
            {newBetType === 'Skins' && (
                <div className="space-y-2 mt-2">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={newBetCarryOver}
                            onChange={(e) => setNewBetCarryOver(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Enable Carry Over (ties carry to next hole)</span>
                    </label>
                    <p className="text-xs text-gray-600">
                        Each hole is worth ${newBetAmount || 0}. Lowest net score wins. {newBetCarryOver ? 'Ties carry over to next hole.' : 'Ties result in no winner for that hole.'}
                    </p>
                </div>
            )}
        </div>

        <div className="space-y-2 max-h-40 overflow-y-auto">
            {customBets.length === 0 ? (
                <p className="text-gray-500 italic p-2 bg-gray-50 rounded">
                    Add custom bets here—these are the *only* bets available in Step 3.
                </p>
            ) : (
                customBets.map(bet => (
                    <div key={bet.id} className="grid grid-cols-3 gap-2 items-center p-2 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="font-medium text-gray-700 text-left">{bet.name}</span>
                        <span className="text-sm text-gray-600 font-mono text-left">
                            {bet.type} {
                                bet.type === 'Nassau' ? `($${bet.amount.toFixed(0)}/side)` :
                                bet.type === 'Skins' ? `($${bet.amount.toFixed(0)}/skin${bet.carryOver !== false ? ', CO' : ''})` :
                                bet.type === '9 Point' ? `($${bet.amount.toFixed(0)}/point)` :
                                `($${bet.amount.toFixed(0)})`
                            }
                        </span>
                        <button
                            onClick={() => handleDeleteBet(bet.id)}
                            className="px-2 py-1 text-xs font-medium rounded-lg border bg-white text-red-600 border-red-400 hover:bg-red-50"
                        >
                            Delete
                        </button>
                    </div>
                ))
            )}
        </div>
    </div>
);

const JunkManager = ({
    dbReady,
    selectedJunkTypes,
    setSelectedJunkTypes,
    junkPointValues,
    setJunkPointValues
}) => {
    const toggleJunkType = (junkId) => {
        if (selectedJunkTypes.includes(junkId)) {
            setSelectedJunkTypes(selectedJunkTypes.filter(id => id !== junkId));
        } else {
            setSelectedJunkTypes([...selectedJunkTypes, junkId]);
        }
    };

    return (
        <div className="p-5 bg-white rounded-2xl shadow-xl border-2 border-blue-200">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Junk & Side Bets</h2>
            <p className="text-sm text-gray-600 mb-4">
                Select which Junk bets to track. Points are awarded per event and can be worth different amounts.
            </p>
            
            <div className="space-y-3">
                {JUNK_TYPES.map(junk => {
                    const isSelected = selectedJunkTypes.includes(junk.id);
                    const pointValue = junkPointValues[junk.id] || junk.points;
                    
                    return (
                        <div key={junk.id} className={`p-3 rounded-lg border-2 ${isSelected ? 'bg-gray-50 border-gray-300' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex items-center justify-between mb-2">
                                <label className="flex items-center space-x-2 cursor-pointer flex-grow">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleJunkType(junk.id)}
                                        disabled={!dbReady}
                                        className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
                                    />
                                    <div>
                                        <span className="font-semibold text-gray-800">{junk.name}</span>
                                        <span className="text-xs text-gray-600 ml-2">({junk.description})</span>
                                    </div>
                                </label>
                                {isSelected && (
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm text-gray-600">Points:</span>
                                        <input
                                            type="number"
                                            value={pointValue}
                                            onChange={(e) => setJunkPointValues({
                                                ...junkPointValues,
                                                [junk.id]: parseFloat(e.target.value) || 1
                                            })}
                                            min="0"
                                            step="0.5"
                                            className="w-16 p-1 border border-gray-300 rounded text-center text-sm"
                                            disabled={!dbReady}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {selectedJunkTypes.length > 0 && (
                <div className="mt-4 p-3 bg-gray-100 rounded-lg border border-gray-300">
                    <p className="text-xs text-gray-800">
                        <strong>Selected:</strong> {selectedJunkTypes.map(id => JUNK_TYPES.find(j => j.id === id)?.name).join(', ')}
                    </p>
                </div>
            )}
        </div>
    );
};

const CourseManager = ({
    dbReady,
    courses,
    newCourseName,
    setNewCourseName,
    handleAddCourse,
    handleDeleteCourse,
    holeDataEdit,
    editingCourseId,
    setEditingCourseId,
    editingCourseHoleData,
    setEditingCourseHoleData,
    handleEditCourse,
    handleSaveEditedCourse,
    userId,
    db
}) => {
    const [courseToDelete, setCourseToDelete] = useState(null);
    const editingCourse = editingCourseId ? courses.find(c => c.id === editingCourseId) : null;
    
    // Course search state
    const [cityName, setCityName] = useState('');
    const [citySearchResults, setCitySearchResults] = useState(null);
    const [citySearchLoading, setCitySearchLoading] = useState(false);
    const [citySearchError, setCitySearchError] = useState(null);
    const [importingCourseId, setImportingCourseId] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importedCourseName, setImportedCourseName] = useState('');
    
    // API URLs and Key
    const API_KEY = 'd75f6880-c25f-45f4-91b0-424de3b14c3e';
    const isDevelopment = import.meta.env.DEV;
    const API_BASE_URL = isDevelopment 
        ? '/api/golf/courses'
        : 'https://www.golfapi.io/api/v2.3/courses';
    const COURSES_SEARCH_API_BASE_URL = isDevelopment
        ? '/api/golf/courses'
        : 'https://www.golfapi.io/api/v2.3/courses';
    
    // Convert parsMen and indexesMen arrays to holeData format
    const convertToHoleData = (parsMen, indexesMen) => {
        const holeData = {};
        for (let i = 1; i <= 18; i++) {
            holeData[`hole${i}`] = {
                par: parsMen && parsMen[i - 1] ? parsMen[i - 1] : 4,
                index: indexesMen && indexesMen[i - 1] ? indexesMen[i - 1] : i
            };
        }
        return holeData;
    };

    // Combine clubName and courseName for display
    const getCourseDisplayName = (clubName, courseName) => {
        const club = clubName ? clubName.trim() : '';
        const course = courseName ? courseName.trim() : '';
        
        if (club && course) {
            return `${club} - ${course}`;
        } else if (club) {
            return club;
        } else if (course) {
            return course;
        }
        return 'Unknown Course';
    };
    
    // Search courses by city
    const searchCoursesByCity = async () => {
        if (!cityName.trim()) {
            setCitySearchError('Please enter a city name');
            return;
        }

        setCitySearchLoading(true);
        setCitySearchError(null);
        setCitySearchResults(null);

        try {
            const params = new URLSearchParams({
                city: cityName.trim(),
                country: 'usa',
                measureUnit: 'mi'
            });
            
            const url = `${COURSES_SEARCH_API_BASE_URL}?${params.toString()}`;
            const fetchOptions = {
                method: 'GET'
            };
            
            // Add Authorization header in production (proxy handles it in development)
            if (!isDevelopment) {
                fetchOptions.headers = {
                    'Authorization': `Bearer ${API_KEY}`
                };
            }
            
            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                let errorBody = null;
                try {
                    errorBody = await response.json();
                } catch (e) {
                    try {
                        errorBody = await response.text();
                    } catch (e2) {
                        errorBody = null;
                    }
                }

                const errorMessage = errorBody 
                    ? `Failed to fetch courses: ${response.status} ${response.statusText}\n\nFull Response:\n${JSON.stringify(errorBody, null, 2)}`
                    : `Failed to fetch courses: ${response.status} ${response.statusText}`;

                throw new Error(errorMessage);
            }

            const data = await response.json();
            setCitySearchResults(data);
        } catch (err) {
            setCitySearchError(err.message || 'An error occurred while searching for courses');
        } finally {
            setCitySearchLoading(false);
        }
    };
    
    // Import course from search results
    const handleImportCourseFromResults = async (courseId, e) => {
        if (e) {
            e.stopPropagation();
        }

        if (!courseId) {
            setCitySearchError('No course ID available');
            return;
        }

        if (!userId || !db) {
            setCitySearchError('Please wait for authentication to complete');
            return;
        }

        setImportingCourseId(courseId);
        setCitySearchError(null);

        try {
            const url = `${API_BASE_URL}/${courseId}`;
            const fetchOptions = {
                method: 'GET'
            };
            
            // Add Authorization header in production (proxy handles it in development)
            if (!isDevelopment) {
                fetchOptions.headers = {
                    'Authorization': `Bearer ${API_KEY}`
                };
            }
            
            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                throw new Error(`Failed to fetch course details: ${response.status} ${response.statusText}`);
            }

            const courseData = await response.json();

            if (!courseData.clubName) {
                throw new Error('Course data is missing club name');
            }

            if (!courseData.parsMen || !courseData.indexesMen) {
                throw new Error('Course data is missing par or handicap information');
            }

            const holeData = convertToHoleData(courseData.parsMen, courseData.indexesMen);
            const courseDisplayName = getCourseDisplayName(courseData.clubName, courseData.courseName);
            
            await addDoc(collection(db, getCourseCollectionPath(userId)), {
                name: courseDisplayName,
                holeData: holeData,
                createdAt: serverTimestamp(),
            });

            setImportedCourseName(courseDisplayName);
            setShowImportModal(true);
        } catch (err) {
            setCitySearchError(`Failed to import course: ${err.message}`);
        } finally {
            setImportingCourseId(null);
        }
    };
    
    const handleCityKeyPress = (e) => {
        if (e.key === 'Enter') {
            searchCoursesByCity();
        }
    };

    return (
        <div className="p-5 bg-white rounded-2xl shadow-xl border-2 border-blue-200 w-full">
            <div className="mb-4">
                <h2 className="text-lg font-bold text-blue-800">Manage Courses</h2>
                <p className="text-sm text-gray-500 mt-1">{courses.length} course{courses.length !== 1 ? 's' : ''} saved</p>
            </div>
            
            <div>
            {/* Search Courses by City */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Search by City (30 mile radius)</h3>
                <div className="flex gap-2 mb-3">
                    <input
                        type="text"
                        value={cityName}
                        onChange={(e) => setCityName(e.target.value)}
                        onKeyPress={handleCityKeyPress}
                        placeholder="Enter city name (Carlsbad)"
                        className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm max-w-[65%]"
                    />
                    <button
                        onClick={searchCoursesByCity}
                        disabled={citySearchLoading || !cityName.trim()}
                        className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm whitespace-nowrap"
                    >
                        {citySearchLoading ? 'Searching...' : 'Search'}
                    </button>
                </div>
                {citySearchError && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                        {citySearchError}
                    </div>
                )}
                
                {/* City Search Results */}
                {citySearchResults && (
                    <div className="mt-4 p-4 bg-white border border-gray-300 rounded-lg">
                        <h4 className="text-md font-bold mb-3 text-gray-800">
                            Courses Found ({Array.isArray(citySearchResults) ? citySearchResults.length : citySearchResults.courses?.length || 0})
                        </h4>
                        <div className="max-h-96 overflow-y-auto space-y-2">
                            {Array.isArray(citySearchResults) ? (
                                citySearchResults.map((course, index) => {
                                    const courseId = course.courseID;
                                    return (
                                        <div
                                            key={courseId || index}
                                            className={`p-3 rounded-lg border transition ${
                                                courseId 
                                                    ? 'bg-gray-50 border-gray-300' 
                                                    : 'bg-gray-100 border-gray-200'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="font-semibold text-gray-800">{course.clubName || course.name || 'Unknown Course'}</div>
                                                    {course.courseName && (
                                                        <div className="text-sm font-medium text-gray-700 mt-1">Course: {course.courseName}</div>
                                                    )}
                                                    {course.city && course.state && (
                                                        <div className="text-sm text-gray-600">{course.city}, {course.state}</div>
                                                    )}
                                                </div>
                                                {courseId && (
                                                    <button
                                                        onClick={(e) => handleImportCourseFromResults(courseId, e)}
                                                        disabled={importingCourseId === courseId || !userId}
                                                        className="ml-3 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition whitespace-nowrap"
                                                    >
                                                        {importingCourseId === courseId ? 'Importing...' : 'Import'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : citySearchResults.courses ? (
                                citySearchResults.courses.map((course, index) => {
                                    const courseId = course.courseID;
                                    return (
                                        <div
                                            key={courseId || index}
                                            className={`p-3 rounded-lg border transition ${
                                                courseId 
                                                    ? 'bg-gray-50 border-gray-300' 
                                                    : 'bg-gray-100 border-gray-200'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="font-semibold text-gray-800">{course.clubName || course.name || 'Unknown Course'}</div>
                                                    {course.courseName && (
                                                        <div className="text-sm font-medium text-gray-700 mt-1">Course: {course.courseName}</div>
                                                    )}
                                                    {course.city && course.state && (
                                                        <div className="text-sm text-gray-600">{course.city}, {course.state}</div>
                                                    )}
                                                </div>
                                                {courseId && (
                                                    <button
                                                        onClick={(e) => handleImportCourseFromResults(courseId, e)}
                                                        disabled={importingCourseId === courseId || !userId}
                                                        className="ml-3 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition whitespace-nowrap"
                                                    >
                                                        {importingCourseId === courseId ? 'Importing...' : 'Import'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-gray-500 text-center py-4">No courses found</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            
            {/* Add New Course Section */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Add New Course Manually</h3>
                <div className="flex space-x-2 mb-3">
                    <input
                        type="text"
                        placeholder="Course Name"
                        value={newCourseName}
                        onChange={(e) => setNewCourseName(e.target.value)}
                        className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                        onClick={handleAddCourse}
                        disabled={!dbReady || !newCourseName.trim()}
                        className="px-3 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition duration-150 shadow-md disabled:opacity-50 text-sm"
                    >
                        Add Course
                    </button>
                </div>
                <p className="text-xs text-gray-600">
                    Enter a course name and click to save the current hole data as a new course.
                </p>
            </div>

            {/* Courses List */}
            <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Existing Courses ({courses.length})</h3>
                {courses.length === 0 ? (
                    <p className="text-gray-500 italic p-4 bg-gray-50 rounded text-sm text-center">
                        No courses saved yet. Add a course above using the current hole data.
                    </p>
                ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {[...courses].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(course => {
                            const isEditing = editingCourseId === course.id;
                            
                            return (
                                <div key={course.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    {!isEditing ? (
                                        // View Mode
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-gray-700">{course.name}</span>
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={() => handleEditCourse(course.id)}
                                                    className="px-3 py-1 bg-gray-500 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition duration-150"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => setCourseToDelete({ id: course.id, name: course.name })}
                                                    className="px-3 py-1 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition duration-150"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // Edit Mode
                                        <div className="space-y-4">
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="text"
                                                    value={editingCourseHoleData?.name || course.name}
                                                    onChange={(e) => setEditingCourseHoleData({
                                                        ...editingCourseHoleData,
                                                        name: e.target.value
                                                    })}
                                                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 font-medium"
                                                />
                                            </div>
                                            
                                            {/* Hole Data Editor for Editing */}
                                            <div className="bg-white p-3 rounded-lg border border-blue-300">
                                                <p className="text-xs text-gray-700 mb-2 text-center font-medium">
                                                    Edit Par (3–5) and HCP Index (1–18)
                                                </p>
                                                <div className="overflow-x-auto">
                                                    <div className="inline-block min-w-full">
                                                        <table className="w-full text-center border-collapse text-xs">
                                                            <thead>
                                                                <tr className="bg-gray-300">
                                                                    <th className="p-1 border border-gray-400 font-bold">Hole</th>
                                                                    {HOLE_NUMBERS.map(h => (
                                                                        <th key={h} className="p-1 border border-gray-400 w-10 text-xs font-bold">{h}</th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                <tr className="bg-white">
                                                                    <td className="p-1 text-xs font-bold bg-gray-300 border border-gray-400">Par</td>
                                                                    {HOLE_NUMBERS.map(h => (
                                                                        <td key={`par-${h}`} className="p-1 border border-gray-300">
                                                                            <input
                                                                                type="number"
                                                                                min="3" max="5"
                                                                                value={editingCourseHoleData?.holeData?.[`hole${h}`]?.par || ''}
                                                                                onChange={(e) => {
                                                                                    const newHoleData = { ...editingCourseHoleData.holeData };
                                                                                    newHoleData[`hole${h}`] = {
                                                                                        ...newHoleData[`hole${h}`],
                                                                                        par: e.target.value
                                                                                    };
                                                                                    setEditingCourseHoleData({
                                                                                        ...editingCourseHoleData,
                                                                                        holeData: newHoleData
                                                                                    });
                                                                                }}
                                                                                className="w-10 h-8 text-center text-xs font-bold border border-gray-400 rounded focus:border-blue-600 bg-white"
                                                                            />
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                                <tr className="bg-white">
                                                                    <td className="p-1 text-xs font-bold bg-gray-300 border border-gray-400">Index</td>
                                                                    {HOLE_NUMBERS.map(h => (
                                                                        <td key={`index-${h}`} className="p-1 border border-gray-300">
                                                                            <input
                                                                                type="number"
                                                                                min="1" max="18"
                                                                                value={editingCourseHoleData?.holeData?.[`hole${h}`]?.index || ''}
                                                                                onChange={(e) => {
                                                                                    const newHoleData = { ...editingCourseHoleData.holeData };
                                                                                    newHoleData[`hole${h}`] = {
                                                                                        ...newHoleData[`hole${h}`],
                                                                                        index: e.target.value
                                                                                    };
                                                                                    setEditingCourseHoleData({
                                                                                        ...editingCourseHoleData,
                                                                                        holeData: newHoleData
                                                                                    });
                                                                                }}
                                                                                className="w-10 h-8 text-center text-xs font-bold border border-gray-400 rounded focus:border-blue-600 bg-white"
                                                                            />
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={handleSaveEditedCourse}
                                                    disabled={!dbReady || !editingCourseHoleData?.name?.trim()}
                                                    className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition duration-150 shadow-md disabled:opacity-50"
                                                >
                                                    Save Changes
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingCourseId(null);
                                                        setEditingCourseHoleData(null);
                                                    }}
                                                    className="px-4 py-2 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition duration-150"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            </div>
            
            {/* Confirmation Modal */}
            {courseToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border-2 border-red-200 max-w-md w-full p-6">
                        <div className="flex items-center justify-center mb-4">
                            <div className="bg-red-100 rounded-full p-3">
                                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 text-center mb-2">Delete Course?</h3>
                        <p className="text-gray-600 text-center mb-6">
                            Are you sure you want to delete <span className="font-semibold text-gray-800">"{courseToDelete.name}"</span>? 
                            This action cannot be undone.
                        </p>
                        <div className="flex space-x-3">
                            <button
                                onClick={() => setCourseToDelete(null)}
                                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition duration-150"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    handleDeleteCourse(courseToDelete.id);
                                    setCourseToDelete(null);
                                }}
                                className="flex-1 px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition duration-150 shadow-md"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Success Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all">
                        <div className="flex items-center justify-center mb-4">
                            <div className="bg-green-100 rounded-full p-3">
                                <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 text-center mb-2">
                            Course Imported!
                        </h3>
                        <p className="text-gray-600 text-center mb-4">
                            <span className="font-semibold text-gray-800">{importedCourseName}</span> has been successfully added to your courses.
                        </p>
                        <p className="text-sm text-gray-500 text-center mb-4">
                            You can find it in the "Existing Courses" section below.
                        </p>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
                            <p className="text-sm text-yellow-800 text-center">
                                <span className="font-semibold">⚠️ Important:</span> Please double-check the handicap indexes to ensure they are correct.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowImportModal(false)}
                            className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition duration-150 shadow-md"
                        >
                            Got it!
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const RoundSelector = ({
    dbReady,
    playersCount,
    rounds,
    courses,
    activeRoundId,
    handleStartNewRound,
    handleSelectRound,
    newRoundCourseName,
    setNewRoundCourseName,
    selectedCourseId,
    setSelectedCourseId,
    handleCourseSelect,
    handicapMode,
    setHandicapMode
}) => {
    const activeRound = rounds.find(r => r.id === activeRoundId);

    return (

        <div className="p-5 bg-white rounded-2xl shadow-xl border-2 border-blue-200">
            <div>
            <h2 className="text-lg font-bold text-blue-800 mb-2">Select Course & Handicap Mode</h2>

                <div className="mb-2">
                    <select
                        value={selectedCourseId}
                        onChange={(e) => handleCourseSelect(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 mb-2 bg-white"
                    >
                        <option value="">-- Select Course --</option>
                        {[...courses].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(course => (
                            <option key={course.id} value={course.id}>{course.name}</option>
                        ))}
                    </select>
                </div>
                
                <div className="mb-2">
                  
                    <select
                        value={handicapMode}
                        onChange={(e) => setHandicapMode(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                    >
                        <option value="lowest">Lowest Handicap as 0 (Relative)</option>
                        <option value="gross">Gross Handicap (Absolute)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                        {handicapMode === 'lowest' 
                            ? 'Lowest handicap player gets 0 strokes, others get strokes relative to them.'
                            : 'All players use their actual handicap (1+ get strokes on appropriate holes).'}
                    </p>
                </div>

            </div>
        </div>
    );
};


const BetRecorder = ({ 
    activeRound, 
    allAvailableBets, 
    players, 
    betSelections, 
    handleBetWinnerChange, 
    dbReady, 
    userId,
    roundBets = [],
    handleAddRoundBet,
    handleDeleteRoundBet,
    newRoundBetName = '',
    setNewRoundBetName,
    newRoundBetType = 'everyone',
    setNewRoundBetType,
    newRoundBetAmount = '',
    setNewRoundBetAmount,
    newRoundBetOdds = '',
    setNewRoundBetOdds,
    newRoundBetPlayer1 = '',
    setNewRoundBetPlayer1,
    newRoundBetPlayer2 = '',
    setNewRoundBetPlayer2
}) => {
    if (!activeRound || activeRound.status !== 'Active') return null;

    const playerNames = players.map(p => p.name);
    const manualBets = allAvailableBets.filter(b => b.type !== 'Skins' && b.type !== 'Nassau' && b.type !== 'Match Play' && b.type !== '9 Point');
    const allBets = [...manualBets, ...(roundBets || [])];

    return (
        <div className="p-3 bg-white rounded-xl shadow-lg border-2 border-blue-400 mb-6">
            <h2 className="text-lg font-bold text-center mb-3 text-blue-800">
                Prop Bets
            </h2>

            {/* Add On-The-Fly Bet Form */}
            {handleAddRoundBet && setNewRoundBetName && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-sm font-semibold text-blue-700 mb-2">Add Bet During Round</h3>
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <select
                            value={newRoundBetType || 'everyone'}
                            onChange={(e) => setNewRoundBetType && setNewRoundBetType(e.target.value)}
                            className="flex-1 p-2 text-xs border border-blue-300 rounded-lg bg-white focus:border-blue-600 focus:outline-none"
                        >
                            <option value="everyone">Everyone</option>
                            <option value="twoPlayers">Two Players</option>
                        </select>
                        <input
                            type="text"
                            placeholder="Bet Name"
                            value={newRoundBetName || ''}
                            onChange={(e) => setNewRoundBetName && setNewRoundBetName(e.target.value)}
                            className="flex-1 p-2 text-xs border border-blue-300 rounded-lg focus:border-blue-600 focus:outline-none"
                        />
                    </div>
                    {newRoundBetType === 'twoPlayers' && (
                        <div className="flex gap-2">
                            <select
                                value={newRoundBetPlayer1 || ''}
                                onChange={(e) => setNewRoundBetPlayer1 && setNewRoundBetPlayer1(e.target.value)}
                                className="flex-1 p-2 text-xs border border-blue-300 rounded-lg bg-white focus:border-blue-600 focus:outline-none"
                            >
                                <option value="">Player 1</option>
                                {playerNames.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                            <select
                                value={newRoundBetPlayer2 || ''}
                                onChange={(e) => setNewRoundBetPlayer2 && setNewRoundBetPlayer2(e.target.value)}
                                className="flex-1 p-2 text-xs border border-blue-300 rounded-lg bg-white focus:border-blue-600 focus:outline-none"
                            >
                                <option value="">Player 2</option>
                                {playerNames.filter(n => n !== (newRoundBetPlayer1 || '')).map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {newRoundBetType === 'twoPlayers' ? (
                        <div className="space-y-2">
                            <div className="text-xs text-gray-600 font-semibold">Bet Amounts (with Odds):</div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-600 mb-1 block">If {newRoundBetPlayer1 || 'Player 1'} wins:</label>
                                    <input
                                        type="number"
                                        placeholder="Amount $"
                                        value={newRoundBetAmount || ''}
                                        onChange={(e) => setNewRoundBetAmount && setNewRoundBetAmount(e.target.value)}
                                        className="w-full p-2 text-xs border border-blue-300 rounded-lg focus:border-blue-600 focus:outline-none"
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-gray-600 mb-1 block">If {newRoundBetPlayer2 || 'Player 2'} wins (odds):</label>
                                    <input
                                        type="number"
                                        placeholder="Odds Amount $"
                                        value={newRoundBetOdds || ''}
                                        onChange={(e) => setNewRoundBetOdds && setNewRoundBetOdds(e.target.value)}
                                        className="w-full p-2 text-xs border border-blue-300 rounded-lg focus:border-blue-600 focus:outline-none"
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 italic">
                                Example: $5 base bet, $15 odds = If Player 1 wins, they get $5. If Player 2 wins, they get $15.
                            </p>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <input
                                type="number"
                                placeholder="Winner Gets $"
                                value={newRoundBetAmount || ''}
                                onChange={(e) => setNewRoundBetAmount && setNewRoundBetAmount(e.target.value)}
                                className="flex-1 p-2 text-xs border border-blue-300 rounded-lg focus:border-blue-600 focus:outline-none"
                                min="0"
                                step="0.01"
                            />
                        </div>
                    )}
                    <button
                        onClick={() => handleAddRoundBet && handleAddRoundBet()}
                        disabled={!dbReady || !newRoundBetName.trim() || !newRoundBetAmount || (newRoundBetType === 'twoPlayers' && (!newRoundBetPlayer1 || !newRoundBetPlayer2 || !newRoundBetOdds)) || !handleAddRoundBet}
                        className="w-full py-1.5 px-3 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Add Bet
                    </button>
                </div>
            </div>
            )}

            {/* Display All Bets */}
            {allBets.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                    No bets added yet
                </div>
            ) : (
                <div className="space-y-3">
                    {allBets.map(bet => {
                        const isRoundBet = bet.isRoundBet;
                        const betKey = isRoundBet ? bet.id : bet.name;
                        let displayAmount = `$${bet.amount}`;
                        if (isRoundBet && bet.betType === 'twoPlayers' && bet.odds) {
                            // For two-player bets with odds: show "If Player1 wins: $X, If Player2 wins: $Y"
                            displayAmount = `If ${bet.player1} wins: $${bet.amount}, If ${bet.player2} wins: $${bet.odds}`;
                        } else if (isRoundBet && bet.odds && bet.odds !== bet.amount) {
                            displayAmount = `Winner: $${bet.amount}, Loser: $${bet.odds}`;
                        }
                        const betTypeLabel = isRoundBet && bet.betType === 'twoPlayers' 
                            ? `Two Players (${bet.player1} vs ${bet.player2})`
                            : isRoundBet ? 'Everyone' : `${bet.type || 'Side Bet'}`;
                        
                        return (
                            <div key={betKey} className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1">
                                        <h3 className="text-sm font-bold text-blue-700">{bet.name}</h3>
                                        <p className="text-xs text-gray-600">{betTypeLabel} • {displayAmount}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={betSelections[betKey] || ''}
                                            onChange={(e) => handleBetWinnerChange(betKey, e.target.value)}
                                            className="flex-shrink-0 min-w-[150px] p-2 text-sm font-medium bg-white border border-blue-300 rounded-lg focus:border-blue-600 focus:outline-none"
                                        >
                                            <option value="">-- Select Winner --</option>
                                            {bet.betType === 'twoPlayers' && bet.player1 && bet.player2
                                                ? [bet.player1, bet.player2].map(name => (
                                                    <option key={name} value={name}>{name}</option>
                                                ))
                                                : playerNames.map(name => (
                                                    <option key={name} value={name}>{name}</option>
                                                ))
                                            }
                                        </select>
                                        {isRoundBet && handleDeleteRoundBet && (
                                            <button
                                                onClick={() => handleDeleteRoundBet(bet.id)}
                                                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                                                title="Delete bet"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

        </div>
    );
};

const JunkTracker = ({ 
    selectedJunkTypes, 
    junkPointValues, 
    junkEvents, 
    handleJunkEventChange,
    roundPlayers,
    activeRound
}) => {
    if (!selectedJunkTypes || selectedJunkTypes.length === 0) return null;
    
    const holeData = activeRound?.holeData || {};
    
    // Helper to get player initials (first initial + last initial, all caps)
    const getInitials = (name) => {
        if (!name) return '';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            // First initial + Last initial
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        } else if (parts.length === 1) {
            // Only one name, use first two letters
            return parts[0].substring(0, 2).toUpperCase();
        }
        return '';
    };
    
    return (
        <div className="p-5 bg-gradient-to-r from-gray-50 to-gray-50 rounded-2xl shadow-xl border-2 border-gray-300 mb-6">
            <h2 className="text-lg font-bold text-blue-800 mb-2">Junk / Side Bets Tracker</h2>
            
            {/* Per-Hole Junk Input - Organized by Junk Type */}
            <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">Record Junk Events by Hole</h3>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                    {selectedJunkTypes.map(junkId => {
                        const junkType = JUNK_TYPES.find(j => j.id === junkId);
                        if (!junkType) return null;
                        
                        const isLosingDots = junkId === 'losingDots';
                        const bgColor = isLosingDots ? 'bg-red-50' : 'bg-blue-50';
                        const borderColor = isLosingDots ? 'border-red-300' : 'border-blue-300';
                        const textColor = isLosingDots ? 'text-red-800' : 'text-blue-800';
                        
                        return (
                            <div key={junkId} className={`p-4 rounded-lg border-2 ${borderColor} ${bgColor}`}>
                                <div className="font-bold text-lg mb-3 flex items-center justify-between">
                                    <span className={textColor}>{junkType.name}</span>
                                    <span className="text-xs font-normal text-gray-600">({junkType.description})</span>
                                </div>
                                <div className="space-y-3">
                                    {/* Front 9 Row */}
                                    <div className="flex gap-2">
                                        {/* Player initials column */}
                                        <div className="text-center min-w-[50px]">
                                            <div className="text-xs font-medium text-gray-600 mb-1">Player</div>
                                            <div className="space-y-1">
                                                {roundPlayers.map(player => {
                                                    const initials = getInitials(player.name);
                                                    return (
                                                        <div 
                                                            key={player.name} 
                                                            className="text-xs font-bold text-gray-700 py-1"
                                                        >
                                                            {initials}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        
                                        {/* Holes 1-9 */}
                                        <div className="grid grid-cols-9 gap-2 flex-1">
                                        {HOLE_NUMBERS.slice(0, 9).map(h => {
                                            const holeKey = `hole${h}`;
                                            const holePar = holeData[holeKey]?.par || 0;
                                            
                                            // Hide Greenies if not par 3
                                            if (junkId === 'greenies' && holePar !== 3) {
                                                return (
                                                    <div key={h} className="text-center">
                                                        <div className="text-xs font-medium text-gray-400 mb-1">H{h}</div>
                                                        <div className="space-y-1">
                                                            {roundPlayers.map((player, idx) => (
                                                                <div key={`${player.name}-${h}-${idx}`} className="text-xs text-gray-300 py-1">—</div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            
                                            return (
                                                <div key={h} className="text-center">
                                                    <div className="text-xs font-medium text-gray-600 mb-1">H{h}</div>
                                                    <div className="space-y-1">
                                                        {roundPlayers.map(player => {
                                                            const isChecked = junkEvents[player.name]?.[holeKey]?.[junkId] || false;
                                                            return (
                                                                <label 
                                                                    key={player.name} 
                                                                    className="flex items-center justify-center cursor-pointer py-1"
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={(e) => handleJunkEventChange(player.name, holeKey, junkId, e.target.checked)}
                                                                        className={`w-4 h-4 ${isLosingDots ? 'text-red-600' : 'text-blue-600'} border-gray-300 rounded focus:ring-2 focus:ring-gray-500`}
                                                                    />
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        </div>
                                    </div>
                                    
                                    {/* Back 9 Row */}
                                    <div className="flex gap-2">
                                        {/* Player initials column */}
                                        <div className="text-center min-w-[50px]">
                                            <div className="text-xs font-medium text-gray-600 mb-1">Player</div>
                                            <div className="space-y-1">
                                                {roundPlayers.map(player => {
                                                    const initials = getInitials(player.name);
                                                    return (
                                                        <div 
                                                            key={player.name} 
                                                            className="text-xs font-bold text-gray-700 py-1"
                                                        >
                                                            {initials}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        
                                        {/* Holes 10-18 */}
                                        <div className="grid grid-cols-9 gap-2 flex-1">
                                        {HOLE_NUMBERS.slice(9, 18).map(h => {
                                            const holeKey = `hole${h}`;
                                            const holePar = holeData[holeKey]?.par || 0;
                                            
                                            // Hide Greenies if not par 3
                                            if (junkId === 'greenies' && holePar !== 3) {
                                                return (
                                                    <div key={h} className="text-center">
                                                        <div className="text-xs font-medium text-gray-400 mb-1">H{h}</div>
                                                        <div className="space-y-1">
                                                            {roundPlayers.map((player, idx) => (
                                                                <div key={`${player.name}-${h}-${idx}`} className="text-xs text-gray-300 py-1">—</div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            
                                            return (
                                                <div key={h} className="text-center">
                                                    <div className="text-xs font-medium text-gray-600 mb-1">H{h}</div>
                                                    <div className="space-y-1">
                                                        {roundPlayers.map(player => {
                                                            const isChecked = junkEvents[player.name]?.[holeKey]?.[junkId] || false;
                                                            return (
                                                                <label 
                                                                    key={player.name} 
                                                                    className="flex items-center justify-center cursor-pointer py-1"
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={(e) => handleJunkEventChange(player.name, holeKey, junkId, e.target.checked)}
                                                                        className={`w-4 h-4 ${isLosingDots ? 'text-red-600' : 'text-blue-600'} border-gray-300 rounded focus:ring-2 focus:ring-gray-500`}
                                                                    />
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const JunkTotals = ({ 
    selectedJunkTypes, 
    junkPointValues, 
    junkEvents, 
    roundPlayers,
    activeRound
}) => {
    if (!selectedJunkTypes || selectedJunkTypes.length === 0) return null;
    
    // Calculate total junk points per player
    const junkTotals = {};
    roundPlayers.forEach(player => {
        junkTotals[player.name] = {};
        let totalPoints = 0;
        selectedJunkTypes.forEach(junkId => {
            let count = 0;
            HOLE_NUMBERS.forEach(h => {
                const holeKey = `hole${h}`;
                if (junkEvents[player.name]?.[holeKey]?.[junkId]) {
                    count++;
                }
            });
            const pointValue = junkPointValues[junkId] || 1;
            // Losing dots subtract, all others add
            const points = junkId === 'losingDots' 
                ? -(count * pointValue) 
                : (count * pointValue);
            junkTotals[player.name][junkId] = { count, points };
            totalPoints += points;
        });
        junkTotals[player.name].total = totalPoints;
    });
    
    return (
        <div className="p-5 bg-white rounded-2xl shadow-xl border-2 border-gray-200 mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-3 text-center">Junk Totals</h3>
            <div className="space-y-3">
                {roundPlayers.map(player => {
                    const totals = junkTotals[player.name] || {};
                    return (
                        <div key={player.name} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="font-bold text-gray-800 mb-2">{player.name}</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                {selectedJunkTypes.map(junkId => {
                                    const junkType = JUNK_TYPES.find(j => j.id === junkId);
                                    const data = totals[junkId] || { count: 0, points: 0 };
                                    const isLosingDots = junkId === 'losingDots';
                                    const pointValue = junkPointValues[junkId] || 1;
                                    
                                    return (
                                        <div key={junkId} className="flex justify-between items-center">
                                            <span className="text-gray-700">
                                                {junkType.name}:
                                            </span>
                                            <span className={`font-semibold ${isLosingDots ? 'text-red-600' : 'text-blue-600'}`}>
                                                {data.count > 0 ? (
                                                    <span>
                                                        {data.count} × ${pointValue} = {isLosingDots ? '-' : '+'}${Math.abs(data.points).toFixed(0)}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">0</span>
                                                )}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-300 flex justify-between items-center">
                                <span className="font-semibold text-gray-800">Total:</span>
                                <span className={`text-lg font-bold ${totals.total >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                    {totals.total >= 0 ? '+' : ''}${totals.total?.toFixed(0) || 0}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const SkinsBetTracker = ({ skinsBets, skinsResults, calculatedScores }) => {
    if (!skinsBets || skinsBets.length === 0) return null;
    
    const roundPlayers = calculatedScores.players || [];
    
    return (
        <>
            {skinsBets.map(bet => {
                const result = skinsResults[bet.id];
                if (!result) return null;
                
                return (
                    <div key={bet.id} className="mb-6 p-4 bg-white rounded-xl border-2 border-gray-200">
                        <div className="text-center mb-3">
                            <h3 className="text-lg font-bold text-gray-700">{bet.name}</h3>
                            <p className="text-sm text-gray-600">
                                ${bet.amount} per skin {bet.carryOver !== false ? '(Carry Over)' : '(No Carry Over)'}
                            </p>
                        </div>
                        
                        {/* Skins Won and Winnings */}
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <div className="text-xs font-semibold text-gray-700 uppercase mb-2">
                                {roundPlayers.length === 3 ? 'Skins Won & Net Winnings (Zero-Sum)' : 'Skins Won & Winnings'}
                            </div>
                            <div className="space-y-2">
                                {roundPlayers.map(player => {
                                    const skinsWon = result.skinsWon?.[player.name] || 0;
                                    const netWinnings = result.totalWinnings?.[player.name] || 0;
                                    const grossWinnings = result.grossWinnings?.[player.name] || (skinsWon * bet.amount);
                                    
                                    return (
                                        <div key={player.name} className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-gray-700">{player.name}:</span>
                                            <div className="flex items-center space-x-4">
                                                <span className="text-gray-700 font-semibold">
                                                    {skinsWon} skin{skinsWon !== 1 ? 's' : ''}
                                                </span>
                                                {roundPlayers.length === 3 ? (
                                                    <>
                                                        <span className="text-gray-600 text-xs">
                                                            Gross: ${grossWinnings.toFixed(0)}
                                                        </span>
                                                        <span className={`font-bold ${netWinnings >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                            Net: {netWinnings >= 0 ? '+' : ''}${netWinnings.toFixed(0)}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-blue-600 font-bold">
                                                        ${netWinnings.toFixed(0)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        
                        {/* Current Carry Over Status */}
                        {bet.carryOver !== false && result.carryOverAmount > 0 && (
                            <div className="mt-3 p-2 bg-gray-100 rounded-lg border border-gray-300">
                                <div className="text-xs font-semibold text-gray-800 text-center">
                                    Carry Over: ${result.carryOverAmount.toFixed(0)} on next hole
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </>
    );
};

const NinePointBetTracker = ({ ninePointBets, ninePointResults, calculatedScores }) => {
    if (!ninePointBets || ninePointBets.length === 0) return null;
    
    const roundPlayers = calculatedScores.players || [];
    
    // Only show for 3 players
    if (roundPlayers.length !== 3) return null;
    
    // Helper function to format name as "First Name Last Initial"
    const formatNameShort = (fullName) => {
        if (!fullName) return '';
        const parts = fullName.trim().split(/\s+/);
        if (parts.length === 0) return '';
        if (parts.length === 1) return parts[0];
        // First name + last initial
        return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}`;
    };
    
    return (
        <div className="p-5 bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl shadow-xl border-2 border-blue-300 mb-6">
            <h2 className="text-2xl font-bold text-blue-800 mb-4 text-center">9 Point Bet Tracker</h2>
            
            {ninePointBets.map(bet => {
                const result = ninePointResults[bet.id];
                if (!result) return null;
                
                return (
                    <div key={bet.id} className="mb-4 p-4 bg-white rounded-xl border-2 border-blue-200">
                        <div className="text-center mb-3">
                            <h3 className="text-lg font-bold text-blue-700">{bet.name}</h3>
                            <p className="text-sm text-gray-600">
                                ${bet.amount} per point
                            </p>
                        </div>
                        
                        {/* Points Won and Winnings */}
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-3">
                            <div className="text-xs font-semibold text-gray-700 uppercase mb-2">
                                Points Won & Net Winnings (Zero-Sum)
                            </div>
                            <div className="space-y-2">
                                {roundPlayers.map(player => {
                                    const pointsWon = result.pointsWon?.[player.name] || 0;
                                    const netWinnings = result.netWinnings?.[player.name] || 0;
                                    const grossWinnings = result.grossWinnings?.[player.name] || (pointsWon * bet.amount);
                                    
                                    return (
                                        <div key={player.name} className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-gray-700">{player.name}:</span>
                                            <div className="flex items-center space-x-4">
                                                <span className="text-blue-700 font-semibold">
                                                    {pointsWon} point{pointsWon !== 1 ? 's' : ''}
                                                </span>
                                                <span className="text-gray-600 text-xs">
                                                    Gross: ${grossWinnings.toFixed(0)}
                                                </span>
                                                <span className={`font-bold ${netWinnings >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                    Net: {netWinnings >= 0 ? '+' : ''}${netWinnings.toFixed(0)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        
                        {/* Hole-by-Hole Breakdown (Collapsible) */}
                        <details className="mt-3">
                            <summary className="cursor-pointer text-sm font-semibold text-blue-700 hover:text-blue-800">
                                Hole-by-Hole Breakdown
                            </summary>
                            <div className="mt-2 bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div className="font-semibold text-gray-700">Hole</div>
                                    <div className="font-semibold text-gray-700 col-span-2">Points Distribution</div>
                                    {Array.from({ length: 18 }, (_, i) => i + 1).map(hole => {
                                        const holePoints = result.holePoints?.[hole];
                                        if (!holePoints) return null;
                                        
                                        return (
                                            <React.Fragment key={hole}>
                                                <div className="font-medium text-gray-600">{hole}</div>
                                                <div className="col-span-2 text-gray-700">
                                                    {roundPlayers.map((player, idx) => {
                                                        const points = holePoints[player.name] || 0;
                                                        const shortName = formatNameShort(player.name);
                                                        return (
                                                            <span key={player.name} className={idx > 0 ? 'ml-3' : ''}>
                                                                {shortName}: <span className="font-semibold text-blue-700">{points}</span>
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        </details>
                    </div>
                );
            })}
        </div>
    );
};

const MatchPlayBetTracker = ({ matchPlayBets, matchPlayResults, calculatedScores, activeRound, players: savedPlayers = [] }) => {
    if (!matchPlayBets || matchPlayBets.length === 0) return null;
    
    const roundPlayers = calculatedScores.players || [];
    const isTeamMode = activeRound?.teamMode === 'teams' && activeRound?.teams && activeRound.teams.length > 0;
    const teams = activeRound?.teams || [];
    
    return (
        <div className="p-5 bg-gradient-to-r from-blue-50 to-blue-50 rounded-2xl shadow-xl border-2 border-blue-300 mb-6">
            <h2 className="text-2xl font-bold text-blue-800 mb-4 text-center">Match Play Tracker</h2>
            
            {matchPlayBets.map(bet => {
                const result = matchPlayResults[bet.id];
                if (!result) return null;
                
                // For team mode, aggregate results by team
                let teamResults = {};
                let teamMatchWinner = null;
                
                if (isTeamMode) {
                    teams.forEach(team => {
                        // Map team.playerIds to player names using savedPlayers
                        const teamPlayerNames = team.playerIds
                            .map(playerId => {
                                const savedPlayer = savedPlayers.find(sp => sp.id === playerId);
                                return savedPlayer ? savedPlayer.name : null;
                            })
                            .filter(name => name !== null);
                        
                        let totalHolesWon = 0;
                        let totalNetWinnings = 0;
                        
                        teamPlayerNames.forEach(playerName => {
                            totalHolesWon += result.holeWins?.[playerName] || 0;
                            totalNetWinnings += result.netWinnings?.[playerName] || 0;
                        });
                        
                        teamResults[team.name] = {
                            holesWon: totalHolesWon,
                            netWinnings: totalNetWinnings,
                            playerNames: teamPlayerNames
                        };
                    });
                    
                    // Determine team match winner (team with most holes won)
                    const teamHolesWon = Object.entries(teamResults).map(([teamName, data]) => ({
                        teamName,
                        holesWon: data.holesWon
                    }));
                    teamHolesWon.sort((a, b) => b.holesWon - a.holesWon);
                    if (teamHolesWon.length > 0 && teamHolesWon[0].holesWon > teamHolesWon[1]?.holesWon) {
                        teamMatchWinner = teamHolesWon[0].teamName;
                    }
                }
                
                return (
                    <div key={bet.id} className="mb-4 p-4 bg-white rounded-xl border-2 border-blue-200">
                        <div className="text-center mb-3">
                            <h3 className="text-lg font-bold text-blue-700">{bet.name}</h3>
                            <p className="text-sm text-gray-600">${bet.amount} per match</p>
                        </div>
                        
                        {/* Match Result */}
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 mb-3">
                            <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Match Result</div>
                            <div className="text-lg font-bold text-blue-800">
                                {isTeamMode ? (teamMatchWinner || result.matchWinner || '—') : (result.matchWinner || '—')}
                            </div>
                            {result.matchResult && (
                                <div className="text-sm text-blue-600 mt-1">
                                    {result.matchResult}
                                </div>
                            )}
                        </div>
                        
                        {/* Holes Won */}
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-3">
                            <div className="text-xs font-semibold text-gray-700 uppercase mb-2">
                                {isTeamMode ? 'Holes Won (Team)' : 'Holes Won'}
                            </div>
                            <div className="space-y-1 text-sm">
                                {isTeamMode ? (
                                    Object.entries(teamResults).map(([teamName, data]) => (
                                        <div key={teamName} className="flex justify-between items-center">
                                            <span className="font-medium text-gray-700">{teamName}:</span>
                                            <span className="font-bold text-blue-800">{data.holesWon} hole{data.holesWon !== 1 ? 's' : ''}</span>
                                        </div>
                                    ))
                                ) : (
                                    roundPlayers.map(player => {
                                        const holesWon = result.holeWins?.[player.name] || 0;
                                        return (
                                            <div key={player.name} className="flex justify-between items-center">
                                                <span className="font-medium text-gray-700">{player.name}:</span>
                                                <span className="font-bold text-blue-800">{holesWon} hole{holesWon !== 1 ? 's' : ''}</span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                        
                        {/* Match Status (Up/Down) - For 2 players/teams */}
                        {((!isTeamMode && roundPlayers.length === 2) || (isTeamMode && teams.length === 2)) && result.matchStatus && (
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-3">
                                <div className="text-xs font-semibold text-gray-700 uppercase mb-2">Match Status</div>
                                <div className="space-y-1 text-xs">
                                    {isTeamMode ? (
                                        // For teams, we'd need to calculate team match status from individual players
                                        // This is complex, so we'll skip it for now or show individual status
                                        <div className="text-gray-500 italic">Team match status calculation not available</div>
                                    ) : (
                                        roundPlayers.map(player => {
                                            const status = result.matchStatus[player.name] || [];
                                            const currentStatus = status[status.length - 1] || 0;
                                            return (
                                                <div key={player.name} className="flex justify-between items-center">
                                                    <span className="font-medium text-gray-700">{player.name}:</span>
                                                    <span className={`font-bold ${
                                                        currentStatus > 0 ? 'text-blue-600' : 
                                                        currentStatus < 0 ? 'text-red-600' : 
                                                        'text-gray-600'
                                                    }`}>
                                                        {currentStatus > 0 ? `+${currentStatus}` : 
                                                         currentStatus < 0 ? `${currentStatus}` : 
                                                         'AS'}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* Net Winnings */}
                        {result.netWinnings && (
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <div className="text-xs font-semibold text-gray-700 uppercase mb-2">
                                    {isTeamMode ? 'Net Winnings (Team)' : 'Net Winnings'}
                                </div>
                                <div className="space-y-1 text-sm">
                                    {isTeamMode ? (
                                        Object.entries(teamResults).map(([teamName, data]) => (
                                            <div key={teamName} className="flex justify-between items-center">
                                                <span className="font-medium text-gray-700">{teamName}:</span>
                                                <span className={`text-lg font-bold ${data.netWinnings >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                    {data.netWinnings >= 0 ? '+' : ''}${data.netWinnings.toFixed(0)}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        roundPlayers.map(player => {
                                            const net = result.netWinnings[player.name] || 0;
                                            return (
                                                <div key={player.name} className="flex justify-between items-center">
                                                    <span className="font-medium text-gray-700">{player.name}:</span>
                                                    <span className={`text-lg font-bold ${net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                        {net >= 0 ? '+' : ''}${net.toFixed(0)}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const NassauBetTracker = ({ nassauBets, nassauResults, calculatedScores }) => {
    if (!nassauBets || nassauBets.length === 0) return null;
    
    const roundPlayers = calculatedScores.players || [];
    
    return (
        <div className="p-5 bg-gradient-to-r from-blue-50 to-blue-50 rounded-2xl shadow-xl border-2 border-blue-300 mb-6">
            <h2 className="text-2xl font-bold text-blue-800 mb-4 text-center">Nassau Bet Tracker</h2>
            
            {nassauBets.map(bet => {
                const result = nassauResults[bet.id];
                if (!result) return null;
                
                return (
                    <div key={bet.id} className="mb-4 p-4 bg-white rounded-xl border-2 border-blue-200">
                        <div className="text-center mb-3">
                            <h3 className="text-lg font-bold text-blue-700">{bet.name}</h3>
                            <p className="text-sm text-gray-600">${bet.amount} per side</p>
                        </div>
                        
                        {result.isThreePlayer ? (
                            // 3-Player Matchups Display
                            <div className="space-y-4 mb-3">
                                {/* Summary Winners */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                    {/* Front 9 */}
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                        <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Front 9 Winner</div>
                                        <div className="text-lg font-bold text-blue-800">
                                            {result.front9Winner || '—'}
                                        </div>
                                        {result.front9Winner && result.front9Winner !== 'Tie' && result.front9NetWinnings && (
                                            <div className="text-xs text-blue-600 mt-1">
                                                Net: {result.front9NetWinnings[result.front9Winner] >= 0 ? '+' : ''}${(result.front9NetWinnings[result.front9Winner] || 0).toFixed(0)}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Back 9 */}
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                        <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Back 9 Winner</div>
                                        <div className="text-lg font-bold text-blue-800">
                                            {result.back9Winner || '—'}
                                        </div>
                                        {result.back9Winner && result.back9Winner !== 'Tie' && result.back9NetWinnings && (
                                            <div className="text-xs text-blue-600 mt-1">
                                                Net: {result.back9NetWinnings[result.back9Winner] >= 0 ? '+' : ''}${(result.back9NetWinnings[result.back9Winner] || 0).toFixed(0)}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Total */}
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                        <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Total Winner</div>
                                        <div className="text-lg font-bold text-blue-800">
                                            {result.totalWinner || '—'}
                                        </div>
                                        {result.totalWinner && result.totalWinner !== 'Tie' && result.totalNetWinnings && (
                                            <div className="text-xs text-blue-600 mt-1">
                                                Net: {result.totalNetWinnings[result.totalWinner] >= 0 ? '+' : ''}${(result.totalNetWinnings[result.totalWinner] || 0).toFixed(0)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Individual Matchups Breakdown */}
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <div className="text-xs font-semibold text-gray-700 uppercase mb-2">Individual Matchups Breakdown</div>
                                    {['Front 9', 'Back 9', 'Total'].map((segment, idx) => {
                                        const segmentKey = segment.toLowerCase().replace(' ', '');
                                        const matchups = result[`${segmentKey}Matchups`] || {};
                                        const netWinnings = result[`${segmentKey}NetWinnings`] || {};
                                        const bgColors = ['bg-blue-50', 'bg-blue-50', 'bg-blue-50'];
                                        const borderColors = ['border-blue-200', 'border-blue-200', 'border-blue-200'];
                                        const textColors = ['text-blue-700', 'text-blue-700', 'text-blue-700'];
                                        
                                        return (
                                            <div key={segment} className={`${bgColors[idx]} p-3 rounded-lg border ${borderColors[idx]} mb-2`}>
                                                <div className={`text-xs font-semibold ${textColors[idx]} uppercase mb-2`}>{segment}</div>
                                                <div className="space-y-1 text-sm mb-2">
                                                    {Object.entries(matchups).map(([key, matchup]) => {
                                                        const [playerA, playerB] = key.split('-');
                                                        if (matchup.winner === 'Tie') {
                                                            return (
                                                                <div key={key} className="text-gray-600">
                                                                    {playerA} vs {playerB}: <span className="font-semibold">Tie</span>
                                                                </div>
                                                            );
                                                        }
                                                        return (
                                                            <div key={key} className="text-gray-700">
                                                                {playerA} vs {playerB}: <span className="font-bold text-blue-600">{matchup.winner}</span> wins ${bet.amount}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="mt-2 pt-2 border-t border-gray-300">
                                                    <div className="text-xs font-semibold text-gray-700 uppercase mb-1">Net Winnings</div>
                                                    <div className="space-y-1 text-xs">
                                                        {roundPlayers.map(player => {
                                                            const net = netWinnings[player.name] || 0;
                                                            return (
                                                                <div key={player.name} className="flex justify-between">
                                                                    <span>{player.name}:</span>
                                                                    <span className={`font-bold ${net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                                        {net >= 0 ? '+' : ''}${net.toFixed(0)}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                {/* Total Net Winnings Per Player */}
                                {result.totalNetWinningsPerPlayer && (
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                        <div className="text-xs font-semibold text-gray-700 uppercase mb-2">Total Net Winnings (All Segments)</div>
                                        <div className="space-y-1 text-sm">
                                            {roundPlayers.map(player => {
                                                const totalNet = result.totalNetWinningsPerPlayer[player.name] || 0;
                                                return (
                                                    <div key={player.name} className="flex justify-between items-center">
                                                        <span className="font-medium text-gray-700">{player.name}:</span>
                                                        <span className={`text-lg font-bold ${totalNet >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                            {totalNet >= 0 ? '+' : ''}${totalNet.toFixed(0)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            // 2-Player Display (Original)
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                {/* Front 9 */}
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                    <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Front 9</div>
                                    <div className="text-lg font-bold text-blue-800">
                                        {result.front9Winner || '—'}
                                    </div>
                                    {result.front9Winner && result.front9Winner !== 'Tie' && (
                                        <div className="text-xs text-blue-600 mt-1">
                                            {calculatedScores.playerTotals[result.front9Winner]?.front9Net || 0} net
                                        </div>
                                    )}
                                </div>
                                
                                {/* Back 9 */}
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                    <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Back 9</div>
                                    <div className="text-lg font-bold text-blue-800">
                                        {result.back9Winner || '—'}
                                    </div>
                                    {result.back9Winner && result.back9Winner !== 'Tie' && (
                                        <div className="text-xs text-blue-600 mt-1">
                                            {calculatedScores.playerTotals[result.back9Winner]?.back9Net || 0} net
                                        </div>
                                    )}
                                </div>
                                
                                {/* Total */}
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                    <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Total</div>
                                    <div className="text-lg font-bold text-blue-800">
                                        {result.totalWinner || '—'}
                                    </div>
                                    {result.totalWinner && result.totalWinner !== 'Tie' && (
                                        <div className="text-xs text-blue-600 mt-1">
                                            {calculatedScores.playerTotals[result.totalWinner]?.netTotal || 0} net
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* Up By Display */}
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <div className="text-xs font-semibold text-gray-700 uppercase mb-2">Match Status</div>
                            <div className="space-y-1">
                                {roundPlayers.map(player => {
                                    const front9UpBy = result.front9UpBy?.[player.name];
                                    const back9UpBy = result.back9UpBy?.[player.name];
                                    const totalUpBy = result.totalUpBy?.[player.name];
                                    
                                    // Only show if player has scores
                                    const hasScores = front9UpBy !== undefined || back9UpBy !== undefined || totalUpBy !== undefined;
                                    if (!hasScores) return null;
                                    
                                    return (
                                        <div key={player.name} className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-gray-700">{player.name}:</span>
                                            <div className="flex space-x-3 text-xs">
                                                {front9UpBy !== undefined && (
                                                    <span className={front9UpBy > 0 ? 'text-blue-600 font-bold' : front9UpBy < 0 ? 'text-red-600' : 'text-gray-600'}>
                                                        F9: {front9UpBy > 0 ? `+${front9UpBy}` : front9UpBy < 0 ? `${front9UpBy}` : 'AS'}
                                                    </span>
                                                )}
                                                {back9UpBy !== undefined && (
                                                    <span className={back9UpBy > 0 ? 'text-blue-600 font-bold' : back9UpBy < 0 ? 'text-red-600' : 'text-gray-600'}>
                                                        B9: {back9UpBy > 0 ? `+${back9UpBy}` : back9UpBy < 0 ? `${back9UpBy}` : 'AS'}
                                                    </span>
                                                )}
                                                {totalUpBy !== undefined && (
                                                    <span className={totalUpBy > 0 ? 'text-blue-600 font-bold' : totalUpBy < 0 ? 'text-red-600' : 'text-gray-600'}>
                                                        Tot: {totalUpBy > 0 ? `+${totalUpBy}` : totalUpBy < 0 ? `${totalUpBy}` : 'AS'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const RoundSummary = ({ activeRound, calculatedScores, allAvailableBets, players: savedPlayers = [] }) => {
    const results = activeRound.results || {};
    // In teams mode: winnings contains team totals, individualWinnings contains player totals
    // In singles mode: winnings contains player totals, individualWinnings is same as winnings
    const winnings = results.winnings || {};
    const individualWinnings = results.individualWinnings || winnings; // Individual player winnings (for teams mode)
    const teamWinnings = results.teamWinnings || {};
    const skinsWonData = results.skinsWon || {};
    const junkWinnings = results.junkWinnings || {};
    const nassauResults = calculatedScores.nassauResults || {};
    const skinsResults = calculatedScores.skinsResults || {};
    const matchPlayResults = calculatedScores.matchPlayResults || {};
    const betSelections = activeRound.betSelections || {};
    const roundBets = activeRound.roundBets || [];

    // Extract player totals from calculatedScores (which is ensured to be up-to-date on end)
    const playerTotals = calculatedScores.playerTotals || {};
    const roundPlayers = calculatedScores.players || activeRound.players || [];
    const isTeamMode = activeRound.teamMode === 'teams' && activeRound.teams && activeRound.teams.length > 0;
    const scores = activeRound.scores || {};

    // Helper function to calculate Front 9 Gross for a player
    const getFront9Gross = (playerName) => {
        const playerScores = scores[playerName] || {};
        let total = 0;
        for (let h = 1; h <= 9; h++) {
            const score = parseInt(playerScores[`hole${h}`] || 0);
            if (!isNaN(score) && score > 0) total += score;
        }
        return total || 0;
    };

    // Helper function to calculate Back 9 Gross for a player
    const getBack9Gross = (playerName) => {
        const playerScores = scores[playerName] || {};
        let total = 0;
        for (let h = 10; h <= 18; h++) {
            const score = parseInt(playerScores[`hole${h}`] || 0);
            if (!isNaN(score) && score > 0) total += score;
        }
        return total || 0;
    };

    // Combine player data for display (or team data if in teams mode)
    let summaryData;
    if (isTeamMode) {
        // Create team summary data
        summaryData = activeRound.teams.map(team => {
            // Match team player IDs to actual round players by finding saved players and matching names
            const teamPlayerNames = team.playerIds
                .map(playerId => {
                    const savedPlayer = savedPlayers.find(sp => sp.id === playerId);
                    return savedPlayer ? savedPlayer.name : null;
                })
                .filter(name => name !== null);
            
            const teamPlayers = roundPlayers.filter(p => teamPlayerNames.includes(p.name));
            
            // Sum up team stats
            const teamGross = teamPlayers.reduce((sum, p) => sum + (playerTotals[p.name]?.grossTotal || 0), 0);
            const teamNet = teamPlayers.reduce((sum, p) => sum + (playerTotals[p.name]?.netTotal || 0), 0);
            const teamSkins = teamPlayers.reduce((sum, p) => sum + (skinsWonData[p.name] || 0), 0);
            const teamFront9Gross = teamPlayers.reduce((sum, p) => sum + getFront9Gross(p.name), 0);
            const teamBack9Gross = teamPlayers.reduce((sum, p) => sum + getBack9Gross(p.name), 0);
            
            // Calculate team winnings: use teamWinnings if available, otherwise sum individual player winnings
            // This ensures we always have the correct team total even if teamWinnings wasn't saved
            // Note: individualWinnings includes ALL bet types: Manual, Nassau, Skins, Match Play, AND Junk
            const teamWinningsTotal = teamWinnings[team.name] || 
                teamPlayers.reduce((sum, p) => sum + (individualWinnings[p.name] || 0), 0);
            
            return {
                name: team.name,
                handicap: null, // Teams don't have handicaps
                gross: teamGross,
                net: teamNet,
                skins: teamSkins,
                front9Gross: teamFront9Gross,
                back9Gross: teamBack9Gross,
                winnings: teamWinningsTotal,
                isTeam: true,
                players: teamPlayers.map(p => p.name)
            };
        }).sort((a, b) => b.winnings - a.winnings);
    } else {
        // Individual player summary data
        summaryData = roundPlayers.map(player => ({
            name: player.name,
            handicap: player.handicap,
            gross: playerTotals[player.name]?.grossTotal || 0,
            net: playerTotals[player.name]?.netTotal || 0,
            skins: skinsWonData[player.name] || 0,
            front9Gross: getFront9Gross(player.name),
            back9Gross: getBack9Gross(player.name),
            winnings: winnings[player.name] || 0,
            isTeam: false
        })).sort((a, b) => b.winnings - a.winnings);
    }

    // Calculate winnings breakdown by bet type for verification
    // This calculates GROSS winnings (what each player/team won, not net)
    const calculateWinningsBreakdown = () => {
        const breakdown = {};
        
        // Initialize breakdown for each player/team
        summaryData.forEach(item => {
            breakdown[item.name] = {
                manual: 0,
                nassau: 0,
                skins: 0,
                matchPlay: 0,
                ninePoint: 0,
                junk: 0,
                total: 0 // Will be calculated as sum of gross winnings
            };
        });

        if (isTeamMode) {
            // For teams, aggregate individual player winnings by bet type
            activeRound.teams.forEach(team => {
                // Ensure breakdown is initialized for this team (in case team name doesn't match summaryData)
                if (!breakdown[team.name]) {
                    breakdown[team.name] = {
                        manual: 0,
                        nassau: 0,
                        skins: 0,
                        matchPlay: 0,
                        junk: 0,
                        total: 0
                    };
                }
                
                const teamPlayerNames = team.playerIds
                    .map(playerId => {
                        const savedPlayer = savedPlayers.find(sp => sp.id === playerId);
                        return savedPlayer ? savedPlayer.name : null;
                    })
                    .filter(name => name !== null);
                
                // Manual bets (excluding two-player round bets which are settled separately)
                Object.entries(betSelections).forEach(([betKey, winnerName]) => {
                    if (winnerName && winnerName !== 'N/A') {
                        // Check if it's a two-player round bet (these are settled separately)
                        const roundBet = roundBets.find(b => b.id === betKey);
                        if (roundBet && roundBet.betType === 'twoPlayers') {
                            // Skip two-player bets - they're settled separately
                            return;
                        }
                        
                        // Check if it's an "everyone" round bet
                        if (roundBet && roundBet.betType === 'everyone') {
                            // Include "everyone" round bets in overall settlement
                            if (teamPlayerNames.includes(winnerName)) {
                                breakdown[team.name].manual += roundBet.amount;
                            }
                            return;
                        }
                        
                        // Regular custom bet
                        const bet = allAvailableBets.find(b => b.name === betKey);
                        if (bet && bet.type !== 'Skins' && bet.type !== 'Nassau' && bet.type !== 'Match Play') {
                            if (teamPlayerNames.includes(winnerName)) {
                                breakdown[team.name].manual += bet.amount;
                            }
                        }
                    }
                });
                
                // Round bets (on-the-fly bets) - only include "everyone" bets in overall settlement
                roundBets.forEach(bet => {
                    if (bet.betType === 'everyone') {
                        const winnerName = betSelections[bet.id];
                        if (winnerName && winnerName !== 'N/A') {
                            const teamWithWinner = activeRound.teams?.find(t => {
                                const tPlayerNames = t.playerIds
                                    .map(playerId => {
                                        const savedPlayer = savedPlayers.find(sp => sp.id === playerId);
                                        return savedPlayer ? savedPlayer.name : null;
                                    })
                                    .filter(name => name !== null);
                                return tPlayerNames.includes(winnerName);
                            });
                            if (teamWithWinner && breakdown[teamWithWinner.name]) {
                                breakdown[teamWithWinner.name].manual += bet.amount;
                            }
                        }
                    }
                    // Two-player bets are excluded from overall settlement - they're settled separately
                });

                // Nassau - Only show gross winnings (what they won, not net)
                const nassauBets = allAvailableBets.filter(b => b.type === 'Nassau');
                nassauBets.forEach(bet => {
                    const result = nassauResults[bet.id];
                    if (result) {
                        const amount = bet.amount || 0;
                        if (result.isThreePlayer) {
                            // For 3 players, calculate gross winnings from individual matchups
                            // Each matchup winner gets the bet amount (Front 9, Back 9, Total = 3 matchups per player pair)
                            teamPlayerNames.forEach(playerName => {
                                let grossWon = 0;
                                // Check Front 9, Back 9, and Total matchups
                                ['front9', 'back9', 'total'].forEach(segment => {
                                    const matchups = result[`${segment}Matchups`] || {};
                                    Object.values(matchups).forEach(matchup => {
                                        if (matchup.winner === playerName) {
                                            grossWon += amount;
                                        }
                                    });
                                });
                                breakdown[team.name].nassau += grossWon;
                            });
                        } else {
                            // For 2 players, only count wins
                            if (result.front9Winner && result.front9Winner !== 'Tie' && teamPlayerNames.includes(result.front9Winner)) {
                                breakdown[team.name].nassau += amount;
                            }
                            if (result.back9Winner && result.back9Winner !== 'Tie' && teamPlayerNames.includes(result.back9Winner)) {
                                breakdown[team.name].nassau += amount;
                            }
                            if (result.totalWinner && result.totalWinner !== 'Tie' && teamPlayerNames.includes(result.totalWinner)) {
                                breakdown[team.name].nassau += amount;
                            }
                        }
                    }
                });

                // Skins - Use gross winnings (skins won × amount) for breakdown verification
                const skinsBets = allAvailableBets.filter(b => b.type === 'Skins');
                skinsBets.forEach(bet => {
                    const result = skinsResults[bet.id];
                    if (result) {
                        teamPlayerNames.forEach(playerName => {
                            // Calculate gross winnings: skins won × bet amount
                            const skinsWon = result.skinsWon?.[playerName] || 0;
                            const grossWinnings = result.grossWinnings?.[playerName] || (skinsWon * bet.amount);
                            breakdown[team.name].skins += grossWinnings;
                        });
                    }
                });

                // Match Play - Only show gross winnings (what they won)
                const matchPlayBets = allAvailableBets.filter(b => b.type === 'Match Play');
                matchPlayBets.forEach(bet => {
                    const result = matchPlayResults[bet.id];
                    if (result) {
                        const amount = bet.amount || 0;
                        // Calculate team holes won to determine team match winner
                        let teamHolesWon = 0;
                        teamPlayerNames.forEach(playerName => {
                            teamHolesWon += result.holeWins?.[playerName] || 0;
                        });
                        
                        // Determine if this team won by comparing with other teams
                        let isTeamWinner = false;
                        if (activeRound.teams && activeRound.teams.length > 0) {
                            const allTeamHolesWon = activeRound.teams.map(t => {
                                const tPlayerNames = t.playerIds
                                    .map(playerId => {
                                        const savedPlayer = savedPlayers.find(sp => sp.id === playerId);
                                        return savedPlayer ? savedPlayer.name : null;
                                    })
                                    .filter(name => name !== null);
                                return {
                                    teamName: t.name,
                                    holesWon: tPlayerNames.reduce((sum, pName) => sum + (result.holeWins?.[pName] || 0), 0)
                                };
                            });
                            const maxHolesWon = Math.max(...allTeamHolesWon.map(t => t.holesWon));
                            // Team wins if they have the most holes won and it's more than other teams
                            isTeamWinner = teamHolesWon === maxHolesWon && 
                                         allTeamHolesWon.filter(t => t.holesWon === maxHolesWon).length === 1;
                        } else {
                            // Fallback: check if any team member won individually
                            isTeamWinner = teamPlayerNames.some(playerName => result.matchWinner === playerName);
                        }
                        
                        if (isTeamWinner) {
                            breakdown[team.name].matchPlay += amount;
                        }
                    }
                });

                // 9 Point - Only show positive winnings (what they earned, not what they lost)
                const ninePointBets = allAvailableBets.filter(b => b.type === '9 Point');
                const ninePointResults = calculatedScores.ninePointResults || {};
                ninePointBets.forEach(bet => {
                    const result = ninePointResults[bet.id];
                    if (result && result.grossWinnings) {
                        teamPlayerNames.forEach(playerName => {
                            const grossWinnings = result.grossWinnings[playerName] || 0;
                            if (grossWinnings > 0) {
                                breakdown[team.name].ninePoint += grossWinnings;
                            }
                        });
                    }
                });

                // Junk - Only show positive winnings (what they earned, not what they lost)
                teamPlayerNames.forEach(playerName => {
                    const junkAmount = junkWinnings[playerName] || 0;
                    if (junkAmount > 0) {
                        breakdown[team.name].junk += junkAmount;
                    }
                });
                
                // Calculate total gross winnings for team
                breakdown[team.name].total = breakdown[team.name].manual + breakdown[team.name].nassau + 
                                             breakdown[team.name].skins + breakdown[team.name].matchPlay + 
                                             breakdown[team.name].ninePoint + breakdown[team.name].junk;
            });
        } else {
            // For singles, calculate directly
            // Manual bets (excluding two-player round bets)
            Object.entries(betSelections).forEach(([betKey, winnerName]) => {
                if (winnerName && winnerName !== 'N/A') {
                    // Check if it's a two-player round bet (these are settled separately)
                    const roundBet = roundBets.find(b => b.id === betKey);
                    if (roundBet && roundBet.betType === 'twoPlayers') {
                        // Skip two-player bets - they're settled separately
                        return;
                    }
                    
                    // Check if it's an "everyone" round bet
                    if (roundBet && roundBet.betType === 'everyone') {
                        // Include "everyone" round bets in overall settlement
                        if (breakdown[winnerName]) {
                            breakdown[winnerName].manual += roundBet.amount;
                        }
                        return;
                    }
                    
                    // Regular custom bet
                    const bet = allAvailableBets.find(b => b.name === betKey);
                    if (bet && bet.type !== 'Skins' && bet.type !== 'Nassau' && bet.type !== 'Match Play') {
                        if (breakdown[winnerName]) {
                            breakdown[winnerName].manual += bet.amount;
                        }
                    }
                }
            });
            
            // Round bets (on-the-fly bets) - only include "everyone" bets in overall settlement
            roundBets.forEach(bet => {
                if (bet.betType === 'everyone') {
                    const winnerName = betSelections[bet.id];
                    if (winnerName && winnerName !== 'N/A' && breakdown[winnerName]) {
                        breakdown[winnerName].manual += bet.amount;
                    }
                }
                // Two-player bets are excluded from overall settlement - they're settled separately
            });

            // Nassau - Only show gross winnings (what they won, not net)
            const nassauBets = allAvailableBets.filter(b => b.type === 'Nassau');
            nassauBets.forEach(bet => {
                const result = nassauResults[bet.id];
                if (result) {
                    const amount = bet.amount || 0;
                    if (result.isThreePlayer) {
                        // For 3 players, calculate gross winnings from individual matchups
                        // Each matchup winner gets the bet amount (Front 9, Back 9, Total = 3 matchups per player pair)
                        ['front9', 'back9', 'total'].forEach(segment => {
                            const matchups = result[`${segment}Matchups`] || {};
                            Object.values(matchups).forEach(matchup => {
                                if (matchup.winner && matchup.winner !== 'Tie' && breakdown[matchup.winner]) {
                                    breakdown[matchup.winner].nassau += amount;
                                }
                            });
                        });
                    } else {
                        // For 2 players, only count wins
                        if (result.front9Winner && result.front9Winner !== 'Tie' && breakdown[result.front9Winner]) {
                            breakdown[result.front9Winner].nassau += amount;
                        }
                        if (result.back9Winner && result.back9Winner !== 'Tie' && breakdown[result.back9Winner]) {
                            breakdown[result.back9Winner].nassau += amount;
                        }
                        if (result.totalWinner && result.totalWinner !== 'Tie' && breakdown[result.totalWinner]) {
                            breakdown[result.totalWinner].nassau += amount;
                        }
                    }
                }
            });

            // Skins - Use gross winnings (skins won × amount) for breakdown verification
            const skinsBets = allAvailableBets.filter(b => b.type === 'Skins');
            skinsBets.forEach(bet => {
                const result = skinsResults[bet.id];
                if (result) {
                    Object.entries(result.skinsWon || {}).forEach(([playerName, skinsWon]) => {
                        if (breakdown[playerName]) {
                            // Calculate gross winnings: skins won × bet amount
                            const grossWinnings = result.grossWinnings?.[playerName] || (skinsWon * bet.amount);
                            breakdown[playerName].skins += grossWinnings;
                        }
                    });
                }
            });

            // Match Play - Only show gross winnings (what they won)
            const matchPlayBets = allAvailableBets.filter(b => b.type === 'Match Play');
            matchPlayBets.forEach(bet => {
                const result = matchPlayResults[bet.id];
                if (result) {
                    const amount = bet.amount || 0;
                    // Only count if player won the match
                    if (result.matchWinner && result.matchWinner !== 'Tie' && breakdown[result.matchWinner]) {
                        breakdown[result.matchWinner].matchPlay += amount;
                    }
                }
            });

            // 9 Point - Only show positive winnings (what they earned, not what they lost)
            const ninePointBets = allAvailableBets.filter(b => b.type === '9 Point');
            const ninePointResults = calculatedScores.ninePointResults || {};
            ninePointBets.forEach(bet => {
                const result = ninePointResults[bet.id];
                if (result && result.grossWinnings) {
                    Object.entries(result.grossWinnings).forEach(([playerName, grossWinnings]) => {
                        if (breakdown[playerName] && grossWinnings > 0) {
                            breakdown[playerName].ninePoint += grossWinnings;
                        }
                    });
                }
            });

            // Junk - Only show positive winnings (what they earned, not what they lost)
            Object.entries(junkWinnings).forEach(([playerName, net]) => {
                if (breakdown[playerName] && net > 0) {
                    breakdown[playerName].junk += net;
                }
            });
            
            // Calculate total gross winnings for each player
            Object.keys(breakdown).forEach(playerName => {
                breakdown[playerName].total = breakdown[playerName].manual + breakdown[playerName].nassau + 
                                             breakdown[playerName].skins + breakdown[playerName].matchPlay + 
                                             breakdown[playerName].ninePoint + breakdown[playerName].junk;
            });
        }

        return breakdown;
    };

    const winningsBreakdown = calculateWinningsBreakdown();

    // Calculate zero-sum settlement (who pays who)
    // Uses GROSS winnings from breakdown to determine settlements
    // For 2 teams/players: Simple net difference (Team A $30 - Team B $5 = Team B owes Team A $25)
    // For 3+ teams/players: Zero-sum based on average
    const calculateSettlement = () => {
        if (summaryData.length === 0) return [];

        // Get gross winnings from breakdown for each player/team
        const grossWinningsMap = {};
        summaryData.forEach(item => {
            const breakdown = winningsBreakdown[item.name] || { total: 0 };
            grossWinningsMap[item.name] = breakdown.total || 0;
        });

        // For 2 teams/players: Simple net difference
        if (summaryData.length === 2) {
            const [team1, team2] = summaryData.sort((a, b) => (grossWinningsMap[b.name] || 0) - (grossWinningsMap[a.name] || 0));
            const team1Gross = grossWinningsMap[team1.name] || 0;
            const team2Gross = grossWinningsMap[team2.name] || 0;
            const netDifference = team1Gross - team2Gross;
            
            if (netDifference > 0.01) {
                return [{
                    from: team2.name,
                    to: team1.name,
                    amount: parseFloat(netDifference.toFixed(2))
                }];
            }
            return [];
        }

        // For 3+ teams/players: Zero-sum based on average
        const totalGrossWinnings = summaryData.reduce((sum, p) => sum + (grossWinningsMap[p.name] || 0), 0);
        const averageGrossWinnings = totalGrossWinnings / (summaryData.length || 1);

        // Separate winners and losers based on gross winnings vs average
        const winners = summaryData
            .filter(p => (grossWinningsMap[p.name] || 0) > averageGrossWinnings + 0.01)
            .sort((a, b) => (grossWinningsMap[b.name] || 0) - (grossWinningsMap[a.name] || 0));
        const losers = summaryData.filter(p => (grossWinningsMap[p.name] || 0) <= averageGrossWinnings + 0.01);

        if (winners.length === 0 || losers.length === 0) return [];

        // Calculate total gross winnings above average (what winners won above average)
        const winnersTotalAboveAverage = winners.reduce((sum, p) => {
            const gross = grossWinningsMap[p.name] || 0;
            return sum + (gross - averageGrossWinnings);
        }, 0);
        
        if (winnersTotalAboveAverage <= 0) return [];

        // Each loser pays their share of the total above-average winnings
        const amountPerLoser = winnersTotalAboveAverage / losers.length;

        // Create settlements: each loser pays each winner proportionally based on how much above average they are
        const settlements = [];
        
        for (const loser of losers) {
            // Calculate how much this loser owes to each winner
            for (const winner of winners) {
                const winnerGross = grossWinningsMap[winner.name] || 0;
                const winnerAboveAverage = winnerGross - averageGrossWinnings;
                if (winnerAboveAverage > 0 && winnersTotalAboveAverage > 0) {
                    const loserShare = (winnerAboveAverage / winnersTotalAboveAverage) * amountPerLoser;
                    if (loserShare >= 0.01) {
                        settlements.push({
                            from: loser.name,
                            to: winner.name,
                            amount: parseFloat(loserShare.toFixed(2))
                        });
                    }
                }
            }
        }

        // Group settlements by from/to pairs to combine amounts
        const groupedSettlements = {};
        settlements.forEach(s => {
            const key = `${s.from}->${s.to}`;
            if (!groupedSettlements[key]) {
                groupedSettlements[key] = { from: s.from, to: s.to, amount: 0 };
            }
            groupedSettlements[key].amount += s.amount;
        });

        // Convert back to array and round amounts
        return Object.values(groupedSettlements).map(s => ({
            from: s.from,
            to: s.to,
            amount: parseFloat(s.amount.toFixed(2))
        }));
    };

    const settlements = calculateSettlement();
    
    // Calculate separate settlements for two-player round bets
    const calculateTwoPlayerBetSettlements = () => {
        const twoPlayerSettlements = [];
        
        roundBets.forEach(bet => {
            if (bet.betType === 'twoPlayers') {
                const winnerName = betSelections[bet.id];
                if (winnerName && winnerName !== 'N/A') {
                    if (winnerName === bet.player1) {
                        // Player 1 wins - they get base amount, Player 2 pays base amount
                        twoPlayerSettlements.push({
                            betName: bet.name,
                            from: bet.player2,
                            to: bet.player1,
                            amount: bet.amount
                        });
                    } else if (winnerName === bet.player2) {
                        // Player 2 wins - they get odds amount, Player 1 pays odds amount
                        twoPlayerSettlements.push({
                            betName: bet.name,
                            from: bet.player1,
                            to: bet.player2,
                            amount: bet.odds || bet.amount
                        });
                    }
                }
            }
        });
        
        return twoPlayerSettlements;
    };
    
    const twoPlayerSettlements = calculateTwoPlayerBetSettlements();
    
    // Debug: Log settlement calculation for teams
    if (isTeamMode && settlements.length === 0) {
        console.log('Team Mode Settlement Debug:', {
            summaryData: summaryData.map(s => ({ name: s.name })),
            winningsBreakdown: Object.keys(winningsBreakdown).map(key => ({
                name: key,
                total: winningsBreakdown[key]?.total || 0
            })),
            grossWinningsMap: summaryData.reduce((acc, item) => {
                const breakdown = winningsBreakdown[item.name] || { total: 0 };
                acc[item.name] = breakdown.total || 0;
                return acc;
            }, {})
        });
    }

    // Calculate net amounts for display (zero-sum: positive = owed, negative = owes)
    // Uses GROSS winnings from breakdown
    const grossWinningsMap = {};
    summaryData.forEach(item => {
        const breakdown = winningsBreakdown[item.name] || { total: 0 };
        grossWinningsMap[item.name] = breakdown.total || 0;
    });
    
    const totalGrossWinnings = summaryData.reduce((sum, p) => sum + (grossWinningsMap[p.name] || 0), 0);
    const averageGrossWinnings = totalGrossWinnings / (summaryData.length || 1);
    const netAmountsMap = {};
    summaryData.forEach(player => {
        netAmountsMap[player.name] = (grossWinningsMap[player.name] || 0) - averageGrossWinnings;
    });

    return (
        <div className="p-6 bg-white rounded-xl shadow-2xl border-t-4 border-red-500 mb-6">
            <h2 className="text-3xl font-bold mb-4 text-red-800 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Round Ended: {activeRound.courseName || 'Unspecified'}

            </h2>
            
            {/* Winnings Breakdown by Bet Type - For Verification */}
            <div className="mb-6 p-4 rounded-xl border-2 border-blue-400 bg-blue-50">
                <h4 className="text-lg font-bold text-blue-800 mb-3 text-center">
                    📊 Winnings Breakdown {isTeamMode ? '(Teams)' : '(Singles)'}
                </h4>
                <div className="space-y-3">
                    {summaryData.map(item => {
                        const breakdown = winningsBreakdown[item.name] || { manual: 0, nassau: 0, skins: 0, matchPlay: 0, ninePoint: 0, junk: 0, total: 0 };
                        return (
                            <div key={item.name} className="bg-white p-3 rounded-lg border border-blue-300">
                                <div className="font-semibold text-blue-900 mb-2">{item.name}</div>
                                <div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-xs">
                                    <div>
                                        <div className="text-gray-600 font-semibold">Manual</div>
                                        <div className="font-bold text-blue-600">
                                            ${breakdown.manual.toFixed(0)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-gray-600 font-semibold">Nassau</div>
                                        <div className="font-bold text-blue-600">
                                            ${breakdown.nassau.toFixed(0)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-gray-600 font-semibold">Skins</div>
                                        <div className="font-bold text-blue-600">
                                            ${breakdown.skins.toFixed(0)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-gray-600 font-semibold">Match Play</div>
                                        <div className="font-bold text-blue-600">
                                            ${breakdown.matchPlay.toFixed(0)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-gray-600 font-semibold">9 Point</div>
                                        <div className="font-bold text-blue-600">
                                            ${breakdown.ninePoint.toFixed(0)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-gray-600 font-semibold">Junk</div>
                                        <div className="font-bold text-blue-600">
                                            ${breakdown.junk.toFixed(0)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-gray-600 font-semibold">Total Gross</div>
                                        <div className="font-bold text-lg text-blue-600">
                                            ${breakdown.total.toFixed(0)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            {/* Zero-Sum Settlement Summary - At the Very Top */}
            {settlements.length > 0 && (
                <div className="mb-6 p-4 rounded-xl border-2 border-blue-400 bg-blue-50">
                    <h4 className="text-lg font-bold text-blue-800 mb-3 text-center">
                        💰 Settlement Summary {isTeamMode ? '(Teams)' : '(Singles)'}
                    </h4>
                    <div className="space-y-3">
                        {settlements.map((settlement, idx) => {
                            // Get team info if in team mode
                            const fromTeam = isTeamMode ? activeRound.teams?.find(t => t.name === settlement.from) : null;
                            const toTeam = isTeamMode ? activeRound.teams?.find(t => t.name === settlement.to) : null;
                            
                            // Calculate per-player amounts for the team that owes
                            const fromTeamPlayerCount = fromTeam ? fromTeam.playerIds.length : 1;
                            const amountPerPlayer = settlement.amount / fromTeamPlayerCount;
                            
                            return (
                                <div key={idx} className="bg-white p-3 rounded-lg border border-blue-300">
                                    <p className="text-center font-semibold text-blue-900 mb-2">
                                        <span className="text-red-600">{settlement.from}</span> owes <span className="text-blue-600">{settlement.to}</span> <span className="text-blue-800">${settlement.amount.toFixed(2)}</span>
                                    </p>
                                    {isTeamMode && fromTeam && (
                                        <div className="mt-2 pt-2 border-t border-blue-200">
                                            <div className="text-xs font-semibold text-blue-700 mb-2">Team Total Net Due: ${settlement.amount.toFixed(2)}</div>
                                            <div className="text-xs text-blue-600 space-y-1">
                                                <div className="font-semibold mb-1">Individual Team Member Breakdown:</div>
                                                {fromTeam.playerIds.map(playerId => {
                                                    const savedPlayer = savedPlayers.find(sp => sp.id === playerId);
                                                    const playerName = savedPlayer ? savedPlayer.name : 'Unknown';
                                                    return (
                                                        <div key={playerId} className="flex justify-between pl-2">
                                                            <span>{playerName}:</span>
                                                            <span className="font-semibold">${amountPerPlayer.toFixed(2)}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {/* Two-Player Bet Settlements - Separate from Overall Settlement */}
            {twoPlayerSettlements.length > 0 && (
                <div className="mb-6 p-4 rounded-xl border-2 border-blue-400 bg-blue-50">
                    <h4 className="text-lg font-bold text-blue-800 mb-3 text-center">
                        🎯 Two-Player Bet Settlements
                    </h4>
                    <p className="text-xs text-blue-700 mb-3 text-center italic">
                        These bets are settled separately between the two players involved
                    </p>
                    <div className="space-y-3">
                        {twoPlayerSettlements.map((settlement, idx) => (
                            <div key={idx} className="bg-white p-3 rounded-lg border border-blue-300">
                                <p className="text-xs text-blue-700 mb-1 font-semibold">{settlement.betName}</p>
                                <p className="text-center font-semibold text-blue-900">
                                    <span className="text-red-600">{settlement.from}</span> owes <span className="text-blue-600">{settlement.to}</span> <span className="text-blue-800">${settlement.amount.toFixed(2)}</span>
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            
            {/* Previous Winners Block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="p-4 bg-blue-100 rounded-xl shadow-md border border-blue-300">
                    <p className="text-sm font-semibold text-blue-800 uppercase">Gross Score Winner</p>
                    <p className="text-2xl font-extrabold text-blue-900 mt-1">{results.grossWinner || 'N/A'}</p>
                </div>
                <div className="p-4 bg-blue-100 rounded-xl shadow-md border border-blue-300">
                    <p className="text-sm font-semibold text-blue-800 uppercase">Net Score Winner</p>
                    <p className="text-2xl font-extrabold text-blue-900 mt-1">{results.netWinner || 'N/A'}</p>
                </div>
            </div>

            {/* Detailed Score and Winnings Table */}
            <h4 className="text-2xl font-bold mb-4 text-gray-800 border-t pt-4">⛳ Final Scorecard</h4>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-red-200 border border-red-200 rounded-lg">
                    <thead className="bg-red-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-bold text-red-700 uppercase tracking-wider">{isTeamMode ? 'Team' : 'Player'}</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-red-700 uppercase tracking-wider">Front 9 Gross</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-red-700 uppercase tracking-wider">Back 9 Gross</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-red-700 uppercase tracking-wider">Gross Total</th>
                            <th className="px-4 py-3 text-center text-sm font-bold text-red-700 uppercase tracking-wider bg-red-100">Net Total</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-red-100">
                        {summaryData.map((player) => {
                            return (
                                <tr key={player.name} className={player.winnings > 0 ? 'bg-red-50/50' : 'hover:bg-gray-50'}>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                                        {player.name}
                                        {player.isTeam && player.players && (
                                            <div className="text-xs text-gray-500 mt-1">
                                                ({player.players.join(', ')})
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-md text-center text-blue-700 font-bold">{player.front9Gross || '-'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-md text-center text-blue-700 font-bold">{player.back9Gross || '-'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-md text-center text-blue-700 font-bold">{player.gross || '-'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-md text-center text-blue-700 font-extrabold bg-red-100/70">{player.net || '-'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>


            {/* Detailed Bet Payouts Breakdown */}
            <h4 className="text-2xl font-bold mb-4 text-gray-800 border-t pt-6 mt-6">💰 Bet Payouts Breakdown</h4>
            
            <div className="space-y-4">
                {/* Nassau Bets */}
                {allAvailableBets && allAvailableBets.filter(b => b.type === 'Nassau').map(bet => {
                    const result = nassauResults[bet.id];
                    if (!result) return null;
                    
                    const front9Winner = result.front9Winner;
                    const back9Winner = result.back9Winner;
                    const totalWinner = result.totalWinner;
                    const amount = bet.amount || 0;
                    
                    return (
                        <div key={bet.id} className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                            <h5 className="text-lg font-bold text-blue-800 mb-3">{bet.name} - ${amount} per side</h5>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-white p-3 rounded border border-blue-300">
                                    <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Front 9</div>
                                    <div className="text-sm font-bold text-blue-900">
                                        {front9Winner && front9Winner !== 'Tie' ? (
                                            <span>{front9Winner}: <span className="text-blue-600">+${amount}</span></span>
                                        ) : (
                                            <span className="text-gray-500">No Winner</span>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-white p-3 rounded border border-blue-300">
                                    <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Back 9</div>
                                    <div className="text-sm font-bold text-blue-900">
                                        {back9Winner && back9Winner !== 'Tie' ? (
                                            <span>{back9Winner}: <span className="text-blue-600">+${amount}</span></span>
                                        ) : (
                                            <span className="text-gray-500">No Winner</span>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-white p-3 rounded border border-blue-300">
                                    <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Total</div>
                                    <div className="text-sm font-bold text-blue-900">
                                        {totalWinner && totalWinner !== 'Tie' ? (
                                            <span>{totalWinner}: <span className="text-blue-600">+${amount}</span></span>
                                        ) : (
                                            <span className="text-gray-500">No Winner</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {/* Skins Bets */}
                {allAvailableBets && allAvailableBets.filter(b => b.type === 'Skins').map(bet => {
                    const result = skinsResults[bet.id];
                    if (!result) return null;
                    
                    const skinsWon = result.skinsWon || {};
                    const totalWinnings = result.totalWinnings || {};
                    const amount = bet.amount || 0;
                    const hasWinners = Object.values(skinsWon).some(count => count > 0);
                    const carryOver = bet.carryOver !== false; // Default to true if not specified
                    
                    return (
                        <div key={bet.id} className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                            <div className="flex items-center justify-between mb-3">
                                <h5 className="text-lg font-bold text-gray-800">{bet.name} - ${amount} per skin</h5>
                                <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-full">
                                    {carryOver ? 'Carry Over' : 'No Carry Over'}
                                </span>
                            </div>
                            {hasWinners ? (
                                <div className="space-y-2">
                                    {roundPlayers.map(player => {
                                        const count = skinsWon[player.name] || 0;
                                        const winnings = totalWinnings[player.name] || 0;
                                        if (count === 0) return null;
                                        return (
                                            <div key={player.name} className="bg-white p-2 rounded border border-gray-300 flex justify-between items-center">
                                                <span className="font-medium text-gray-800">{player.name}</span>
                                                <span className="text-sm text-gray-700">
                                                    {count} skin{count !== 1 ? 's' : ''} × ${amount} = <span className="text-blue-600 font-bold">${winnings.toFixed(0)}</span>
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500 italic">No skins won</div>
                            )}
                        </div>
                    );
                })}
                
                {/* Junk/Side Bets */}
                {activeRound.selectedJunkTypes && activeRound.selectedJunkTypes.length > 0 && (
                    <div className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                        <h5 className="text-lg font-bold text-gray-800 mb-3">Junk / Side Bets</h5>
                        <div className="space-y-3">
                            {activeRound.selectedJunkTypes.map(junkId => {
                                const junkType = JUNK_TYPES.find(j => j.id === junkId);
                                if (!junkType) return null;
                                
                                const pointValue = activeRound.junkPointValues?.[junkId] || 1;
                                const isLosingDots = junkId === 'losingDots';
                                
                                // Calculate totals for this junk type
                                const typeWinnings = {};
                                roundPlayers.forEach(player => {
                                    let count = 0;
                                    HOLE_NUMBERS.forEach(h => {
                                        const holeKey = `hole${h}`;
                                        if (activeRound.junkEvents?.[player.name]?.[holeKey]?.[junkId]) {
                                            count++;
                                        }
                                    });
                                    const points = isLosingDots ? -(count * pointValue) : (count * pointValue);
                                    if (count > 0 || points !== 0) {
                                        typeWinnings[player.name] = { count, points };
                                    }
                                });
                                
                                if (Object.keys(typeWinnings).length === 0) return null;
                                
                                return (
                                    <div key={junkId} className="bg-white p-3 rounded border border-gray-300">
                                        <div className="font-semibold text-gray-700 mb-2">{junkType.name} (${pointValue} per event)</div>
                                        <div className="space-y-1">
                                            {Object.entries(typeWinnings).map(([playerName, data]) => (
                                                <div key={playerName} className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-700">{playerName}</span>
                                                    <span className={data.points >= 0 ? 'text-blue-600' : 'text-red-600'}>
                                                        {data.count} × ${pointValue} = {data.points >= 0 ? '+' : ''}${data.points.toFixed(0)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                
                {/* Match Play Bets */}
                {allAvailableBets && allAvailableBets.filter(b => b.type === 'Match Play').map(bet => {
                    const result = matchPlayResults[bet.id];
                    if (!result) return null;
                    
                    const amount = bet.amount || 0;
                    const matchResult = result.matchResult;
                    const netWinnings = result.netWinnings || {};
                    
                    // Calculate team winnings and match winner if in teams mode
                    let displayWinnings = {};
                    let displayLabel = isTeamMode ? 'Team' : 'Player';
                    let teamMatchWinner = null;
                    
                    if (isTeamMode && activeRound.teams) {
                        // Calculate holes won per team and determine team match winner
                        const teamHolesWon = {};
                        activeRound.teams.forEach(team => {
                            const teamPlayerNames = team.playerIds
                                .map(playerId => {
                                    const savedPlayer = savedPlayers.find(sp => sp.id === playerId);
                                    return savedPlayer ? savedPlayer.name : null;
                                })
                                .filter(name => name !== null);
                            
                            // Calculate total holes won for this team
                            const totalHolesWon = teamPlayerNames.reduce((sum, playerName) => {
                                return sum + (result.holeWins?.[playerName] || 0);
                            }, 0);
                            teamHolesWon[team.name] = totalHolesWon;
                            
                            // Sum Match Play winnings for all players in this team
                            const teamTotal = teamPlayerNames.reduce((sum, playerName) => {
                                return sum + (netWinnings[playerName] || 0);
                            }, 0);
                            
                            if (teamTotal !== 0) {
                                displayWinnings[team.name] = teamTotal;
                            }
                        });
                        
                        // Determine team match winner (team with most holes won)
                        const teamHolesWonArray = Object.entries(teamHolesWon).map(([teamName, holes]) => ({
                            teamName,
                            holes
                        }));
                        teamHolesWonArray.sort((a, b) => b.holes - a.holes);
                        if (teamHolesWonArray.length > 0 && 
                            teamHolesWonArray[0].holes > (teamHolesWonArray[1]?.holes || 0)) {
                            teamMatchWinner = teamHolesWonArray[0].teamName;
                        }
                    } else {
                        // Individual player winnings
                        roundPlayers.forEach(player => {
                            const net = netWinnings[player.name] || 0;
                            if (net !== 0) {
                                displayWinnings[player.name] = net;
                            }
                        });
                    }
                    
                    // Use team match winner if in team mode, otherwise use individual match winner
                    const displayMatchWinner = isTeamMode ? teamMatchWinner : result.matchWinner;
                    
                    return (
                        <div key={bet.id} className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                            <h5 className="text-lg font-bold text-blue-800 mb-3">{bet.name} - ${amount} per match</h5>
                            
                            {/* Match Result */}
                            <div className="bg-white p-3 rounded border border-blue-300 mb-3">
                                <div className="text-xs font-semibold text-blue-700 uppercase mb-1">Match Winner</div>
                                <div className="text-lg font-bold text-blue-900">
                                    {displayMatchWinner && displayMatchWinner !== 'Tie' ? (
                                        <span>{displayMatchWinner}: <span className="text-blue-600">+${amount}</span></span>
                                    ) : (
                                        <span className="text-gray-500">No Winner / Tie</span>
                                    )}
                                </div>
                                {matchResult && (
                                    <div className="text-sm text-blue-600 mt-1">
                                        {matchResult}
                                    </div>
                                )}
                            </div>
                            
                            {/* Net Winnings per Player/Team */}
                            {Object.keys(displayWinnings).length > 0 && (
                                <div className="bg-white p-3 rounded border border-blue-300">
                                    <div className="text-xs font-semibold text-blue-700 uppercase mb-2">Net Winnings ({displayLabel})</div>
                                    <div className="space-y-2">
                                        {Object.entries(displayWinnings).map(([name, net]) => (
                                            <div key={name} className="flex justify-between items-center text-sm">
                                                <span className="text-gray-700 font-semibold">{name}</span>
                                                <span className={`font-bold ${net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                    {net >= 0 ? '+' : ''}${net.toFixed(0)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                
                {/* Manual Bets */}
                {allAvailableBets && betSelections && (() => {
                    const manualBets = allAvailableBets.filter(b => b.type !== 'Skins' && b.type !== 'Nassau' && b.type !== 'Match Play' && b.type !== '9 Point');
                    const betsWithWinners = manualBets.filter(bet => {
                        const winner = betSelections[bet.name];
                        return winner && winner !== 'N/A' && winner.trim() !== '';
                    });
                    
                    if (betsWithWinners.length === 0) return null;
                    
                    return (
                        <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                            <h5 className="text-lg font-bold text-blue-800 mb-3">Manual Bets</h5>
                            <div className="space-y-2">
                                {betsWithWinners.map(bet => {
                                    const winner = betSelections[bet.name];
                                    return (
                                        <div key={bet.id} className="bg-white p-2 rounded border border-blue-300 flex justify-between items-center">
                                            <span className="font-medium text-gray-800">{bet.name}</span>
                                            <span className="text-sm text-gray-700">
                                                {winner}: <span className="text-blue-600 font-bold">+${bet.amount.toFixed(0)}</span>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}
            </div>

            <p className="mt-8 text-xs text-gray-500 text-center">
                This round is finalized. Re-select the round and click 'Start New Round' if you wish to overwrite it.
            </p>
        </div>
    );
};

const Scorecard = ({ 
    activeRound, 
    activeRoundId,
    scores, 
    handleScoreChange, 
    handleSaveScores, 
    handleEndRound, 
    dbReady, 
    calculatedScores, 
    allAvailableBets,
    selectedJunkTypes,
    junkPointValues,
    junkEvents,
    handleJunkEventChange,
    finalSummaryRef,
    handleRoundPlayerHandicapChange,
    handleRemovePlayerFromRound,
    isReadOnly = false,
    isShareModalOpen,
    setIsShareModalOpen,
    shareCodeInput,
    setShareCodeInput,
    handleEnterShareCode,
    isViewingSharedRound,
    setIsViewingSharedRound,
    setSharedRound,
    setSharedRoundId,
    setActiveRoundId,
    betSelections,
    handleBetWinnerChange,
    userId,
    players,
    roundBets = [],
    handleAddRoundBet,
    handleDeleteRoundBet,
    newRoundBetName = '',
    setNewRoundBetName,
    newRoundBetType = 'everyone',
    setNewRoundBetType,
    newRoundBetAmount = '',
    setNewRoundBetAmount,
    newRoundBetOdds = '',
    setNewRoundBetOdds,
    newRoundBetPlayer1 = '',
    setNewRoundBetPlayer1,
    newRoundBetPlayer2 = '',
    setNewRoundBetPlayer2,
    myPlayerId
}) => {
    const [activeSection, setActiveSection] = useState('front9'); // 'front9' or 'back9'
    
    // Reset to Front 9 when starting a new round
    useEffect(() => {
        setActiveSection('front9');
    }, [activeRoundId]);
    
    if (!activeRound) return null;
    
    const holeData = activeRound.holeData || {};
    const roundPlayers = calculatedScores.players;
    const coursePar = HOLE_NUMBERS.reduce((sum, h) => sum + (holeData[`hole${h}`]?.par || 0), 0);
    const isEnded = activeRound.status === 'Ended';
    const nassauBets = allAvailableBets.filter(b => b.type === 'Nassau');
    const skinsBets = allAvailableBets.filter(b => b.type === 'Skins');
    const matchPlayBets = allAvailableBets.filter(b => b.type === 'Match Play');
    const ninePointBets = allAvailableBets.filter(b => b.type === '9 Point');
    
    // Helper to get player initials (first initial + last initial, all caps)
    const getInitials = (name) => {
        if (!name) return '';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            // First initial + Last initial
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        } else if (parts.length === 1) {
            // Only one name, use first two letters
            return parts[0].substring(0, 2).toUpperCase();
        }
        return '';
    };
    
    // Calculate front 9 and back 9 totals (gross)
    const getFront9Total = (playerName) => {
        const playerScores = scores[playerName] || {};
        let total = 0;
        for (let h = 1; h <= 9; h++) {
            const score = parseInt(playerScores[`hole${h}`] || 0);
            if (!isNaN(score) && score > 0) total += score;
        }
        return total || '-';
    };
    
    const getBack9Total = (playerName) => {
        const playerScores = scores[playerName] || {};
        let total = 0;
        for (let h = 10; h <= 18; h++) {
            const score = parseInt(playerScores[`hole${h}`] || 0);
            if (!isNaN(score) && score > 0) total += score;
        }
        return total || '-';
    };
    
    // Get net totals from calculatedScores
    const getFront9Net = (playerName) => {
        const totals = calculatedScores.playerTotals?.[playerName];
        return totals?.front9Net || '-';
    };
    
    const getBack9Net = (playerName) => {
        const totals = calculatedScores.playerTotals?.[playerName];
        return totals?.back9Net || '-';
    };
    
    // Render traditional scorecard table
    const renderScorecardTable = (holes, sectionName) => {
        const isReadOnlyMode = isEnded || isReadOnly;
        
        return (
            <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border-2 border-gray-300 bg-white">
                    <thead>
                        <tr className="bg-blue-600 text-white">
                            <th className="border border-gray-300 px-3 py-2 text-left font-bold sticky left-0 z-10 bg-blue-600">Player</th>
                            {holes.map(h => {
                                const par = holeData[`hole${h}`]?.par || 4;
                                return (
                                    <th key={h} className="border border-gray-300 px-2 py-2 text-center font-bold">
                                        <div className="text-xs">{h}</div>
                                        <div className="text-xs font-normal">Par {par}</div>
                                    </th>
                                );
                            })}
                            <th className="border border-gray-300 px-3 py-2 text-center font-bold bg-blue-700">
                                {sectionName === 'front9' ? 'Out' : 'In'}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {roundPlayers.map((player, idx) => {
                            const playerScores = scores[player.name] || {};
                            const sectionGross = sectionName === 'front9' 
                                ? getFront9Total(player.name)
                                : getBack9Total(player.name);
                            const sectionNet = sectionName === 'front9'
                                ? getFront9Net(player.name)
                                : getBack9Net(player.name);
                            
                            return (
                                <tr key={player.name} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                                    <td className={`border border-gray-300 px-3 py-2 font-bold text-gray-800 align-top sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1">
                                                <span className="text-sm font-bold">{getInitials(player.name)}</span>
                                                {myPlayerId && players.find(p => p.id === myPlayerId)?.name === player.name && (
                                                    <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded font-semibold">Me</span>
                                                )}
                                            </div>
                                            <span className="text-xs text-gray-500">HCP {player.handicap || 0}</span>
                                        </div>
                                    </td>
                                    {holes.map(h => {
                                        const holeKey = `hole${h}`;
                                        const score = playerScores[holeKey] || '';
                                        const holeInfo = calculatedScores.holeData?.[player.name]?.[holeKey] || {};
                                        const strokes = holeInfo.strokes || 0;
                                        const par = holeData[holeKey]?.par || 4;
                                        
                                        return (
                                            <td key={h} className="border border-gray-300 px-1 py-2 text-center align-top">
                                                {isReadOnlyMode ? (
                                                    <div className="flex flex-col items-center justify-start">
                                                        <div className="text-lg font-bold text-gray-800">
                                                            {score || '-'}
                                                        </div>
                                                        {strokes !== 0 && (
                                                            <div className={`text-xs font-bold mt-0.5 ${strokes > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                                                {strokes > 0 ? `-${strokes}` : `+${Math.abs(strokes)}`}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-start">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={score}
                                                            onChange={(e) => handleScoreChange(player.name, h, e.target.value)}
                                                            className="w-12 h-10 text-center text-lg font-bold border-2 border-blue-300 rounded focus:border-blue-600 focus:outline-none"
                                                        />
                                                        {strokes !== 0 && (
                                                            <div className={`text-xs font-bold mt-0.5 ${strokes > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                                                {strokes > 0 ? `-${strokes}` : `+${Math.abs(strokes)}`}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="border border-gray-300 px-2 py-2 text-center font-bold bg-blue-100 align-top">
                                        <div className="text-xs font-semibold text-gray-700">
                                            {sectionGross}/{sectionNet}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };
    
    if (isEnded) {
        return (
            <div ref={finalSummaryRef}>
                <RoundSummary 
                    activeRound={activeRound} 
                    calculatedScores={calculatedScores}
                    allAvailableBets={allAvailableBets}
                    players={players}
                />
                {/* Full Scorecard in Read-Only Mode */}
                <div className="p-5 bg-white rounded-2xl shadow-2xl border-4 border-blue-500 mt-6">
                    <h2 className="text-xl font-bold text-center text-blue-800 mb-1">Final Scorecard</h2>
                    <h3 className="text-sm text-center text-gray-700 mb-1">
                        {activeRound.courseName || 'Current Round'} • Par {coursePar}
                    </h3>
                    {activeRound?.handicapMode && (
                        <p className="text-xs text-center text-gray-500 mb-3">
                            Handicap Mode: {activeRound.handicapMode === 'lowest' 
                                ? 'Lowest as 0 (Relative)' 
                                : 'Gross (Absolute)'}
                        </p>
                    )}

                    {/* Front 9 */}
                    <div className="mb-6">
                        <h4 className="text-xl font-bold text-blue-700 mb-2">Front 9</h4>
                        {renderScorecardTable([1, 2, 3, 4, 5, 6, 7, 8, 9], 'front9')}
                    </div>

                    {/* Back 9 */}
                    <div className="mb-6">
                        <h4 className="text-xl font-bold text-blue-700 mb-2">Back 9</h4>
                        {renderScorecardTable([10, 11, 12, 13, 14, 15, 16, 17, 18], 'back9')}
                    </div>

                    {/* Totals */}
                    <div className="mt-6 grid grid-cols-2 gap-4">
                        {roundPlayers.map(player => {
                            const totals = calculatedScores.playerTotals[player.name] || { grossTotal: 0, netTotal: 0 };
                            return (
                                <div key={player.name} className="bg-gradient-to-r from-blue-50 to-blue-50 rounded-xl p-4">
                                    <div className="font-bold text-gray-800 mb-2">{player.name}</div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-gray-600">Gross: </span>
                                            <span className="font-bold text-blue-800">{totals.grossTotal || '-'}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Net: </span>
                                            <span className="font-bold text-blue-800">{totals.netTotal || '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                {/* Scorecard div closed above */}
            </div>
        );
    }

    return (
        <>
        {/* Action Buttons at Top */}
        {!isReadOnly && !isEnded && activeRound && activeRound.status === 'Active' && (
            <div className="mb-4 grid grid-cols-2 gap-3">
                <button
                    onClick={() => setIsShareModalOpen(true)}
                    disabled={!dbReady}
                    className="py-2 px-4 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share
                </button>
                <button
                    onClick={handleEndRound}
                    disabled={!dbReady}
                    className="py-2 px-4 bg-red-600 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-red-700 disabled:opacity-50"
                >
                    End Round
                </button>
            </div>
        )}
        
        {/* Share button for ended rounds and shared rounds */}
        {((isEnded && activeRound) || (isViewingSharedRound && activeRound)) && (
            <div className="mb-4">
                <button
                    onClick={() => setIsShareModalOpen(true)}
                    className="w-full py-2 px-4 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share Round
                </button>
            </div>
        )}

        <div className="p-5 bg-white rounded-2xl shadow-2xl border-4 border-blue-500 mb-6">
            <h2 className="text-xl font-bold text-center text-blue-800 mb-1">Scorecard</h2>

            <h3 className="text-sm text-center text-gray-700 mb-1">
                {activeRound.courseName || 'Current Round'} • Par {coursePar}
            </h3>
            {activeRound?.handicapMode && (
                <p className="text-xs text-center text-gray-500 mb-3">
                    Handicap Mode: {activeRound.handicapMode === 'lowest' 
                        ? 'Lowest as 0 (Relative)' 
                        : 'Gross (Absolute)'}
                </p>
            )}

            {/* Section Toggle Buttons */}
            <div className="mb-4 flex gap-2 justify-center">
                <button
                    onClick={() => setActiveSection('front9')}
                    className={`px-6 py-2 font-semibold rounded-lg transition ${
                        activeSection === 'front9'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Front 9
                </button>
                <button
                    onClick={() => setActiveSection('back9')}
                    className={`px-6 py-2 font-semibold rounded-lg transition ${
                        activeSection === 'back9'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                    Back 9
                </button>
            </div>

            {/* Scorecard Table - Now at the top */}
            {activeSection === 'front9' ? (
                <div className="mb-6">
                    {renderScorecardTable([1, 2, 3, 4, 5, 6, 7, 8, 9], 'front9')}
                </div>
            ) : (
                <div className="mb-6">
                    {renderScorecardTable([10, 11, 12, 13, 14, 15, 16, 17, 18], 'back9')}
                </div>
            )}
        </div>

        {/* Record Bet Winners - Right under scorecard */}
        {!isEnded && activeRound && activeRound.status === 'Active' && (
                <div className="mb-6">
                    <BetRecorder
                        activeRound={activeRound}
                        allAvailableBets={allAvailableBets}
                        players={calculatedScores.players}
                        betSelections={betSelections}
                        handleBetWinnerChange={handleBetWinnerChange}
                        dbReady={dbReady}
                        userId={userId}
                        roundBets={roundBets}
                        handleAddRoundBet={handleAddRoundBet}
                        handleDeleteRoundBet={handleDeleteRoundBet}
                        newRoundBetName={newRoundBetName}
                        setNewRoundBetName={setNewRoundBetName}
                        newRoundBetType={newRoundBetType}
                        setNewRoundBetType={setNewRoundBetType}
                        newRoundBetAmount={newRoundBetAmount}
                        setNewRoundBetAmount={setNewRoundBetAmount}
                        newRoundBetOdds={newRoundBetOdds}
                        setNewRoundBetOdds={setNewRoundBetOdds}
                        newRoundBetPlayer1={newRoundBetPlayer1}
                        setNewRoundBetPlayer1={setNewRoundBetPlayer1}
                        newRoundBetPlayer2={newRoundBetPlayer2}
                        setNewRoundBetPlayer2={setNewRoundBetPlayer2}
                    />
                </div>
            )}

        {/* Betting Summaries - Below scorecard */}
        {/* Junk Tracker */}
        {selectedJunkTypes && selectedJunkTypes.length > 0 && (
                <JunkTracker
                    selectedJunkTypes={selectedJunkTypes}
                    junkPointValues={junkPointValues}
                    junkEvents={junkEvents}
                    handleJunkEventChange={handleJunkEventChange}
                    roundPlayers={roundPlayers}
                    activeRound={activeRound}
                />
            )}
        
        {/* Junk Totals - Separate Box Below Junk Tracker */}
        {selectedJunkTypes && selectedJunkTypes.length > 0 && (
            <JunkTotals
                selectedJunkTypes={selectedJunkTypes}
                junkPointValues={junkPointValues}
                junkEvents={junkEvents}
                roundPlayers={roundPlayers}
                activeRound={activeRound}
            />
        )}

        {/* Skins Bet Tracker */}
        {skinsBets.length > 0 && (
                <SkinsBetTracker 
                    skinsBets={skinsBets}
                    skinsResults={calculatedScores.skinsResults || {}}
                    calculatedScores={calculatedScores}
                />
            )}
            
        {/* Nassau Bet Tracker */}
        {nassauBets.length > 0 && (
                <NassauBetTracker 
                    nassauBets={nassauBets}
                    nassauResults={calculatedScores.nassauResults || {}}
                    calculatedScores={calculatedScores}
                />
            )}
            
        {/* Match Play Bet Tracker */}
        {matchPlayBets.length > 0 && (
                <MatchPlayBetTracker 
                    matchPlayBets={matchPlayBets}
                    matchPlayResults={calculatedScores.matchPlayResults || {}}
                    calculatedScores={calculatedScores}
                    activeRound={activeRound}
                    players={players}
                />
            )}
            
        {/* 9 Point Bet Tracker */}
        {ninePointBets.length > 0 && (
                <NinePointBetTracker 
                    ninePointBets={ninePointBets}
                    ninePointResults={calculatedScores.ninePointResults || {}}
                    calculatedScores={calculatedScores}
                />
            )}
        
        {/* Share Modal */}
        {isShareModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl border-2 border-blue-200 max-w-md w-full p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-bold text-blue-800">Share Round</h3>
                        <button
                            onClick={() => {
                                setIsShareModalOpen(false);
                                setShareCodeInput('');
                            }}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    {/* Share Code Display */}
                    {activeRound && activeRound.shareCode && (
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Share Code:
                            </label>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 px-4 py-3 bg-blue-50 border-2 border-blue-400 rounded-lg text-center text-3xl font-bold tracking-widest text-blue-600">
                                    {activeRound.shareCode}
                                </div>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(activeRound.shareCode);
                                        alert('Share code copied to clipboard!');
                                    }}
                                    className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    title="Copy to clipboard"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2 text-center">
                                Share this code with others to let them view this round
                            </p>
                        </div>
                    )}
                    
                    {/* Enter Share Code Section */}
                    <div className="border-t pt-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Enter Share Code to View Round:
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={shareCodeInput}
                                onChange={(e) => setShareCodeInput(e.target.value.toUpperCase().slice(0, 4))}
                                placeholder="ABCD"
                                maxLength={4}
                                className="flex-1 px-4 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-bold tracking-widest uppercase"
                            />
                            <button
                                onClick={async () => {
                                    await handleEnterShareCode();
                                    if (isViewingSharedRound) {
                                        setIsShareModalOpen(false);
                                    }
                                }}
                                disabled={!dbReady || shareCodeInput.length !== 4}
                                className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                View
                            </button>
                        </div>
                    </div>
                    
                    {/* Show if viewing shared round */}
                    {isViewingSharedRound && (
                        <div className="mt-4 p-3 bg-gray-100 border-2 border-gray-400 rounded-lg">
                            <p className="text-sm font-semibold text-gray-800 text-center">
                                📖 Viewing Shared Round (Read-Only)
                            </p>
                            <button
                                onClick={() => {
                                    setIsViewingSharedRound(false);
                                    setSharedRound(null);
                                    setSharedRoundId(null);
                                    setSharedRoundOwnerId(null);
                                    setActiveRoundId(null);
                                    setIsShareModalOpen(false);
                                }}
                                className="mt-2 w-full px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700"
                            >
                                Exit Shared View
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Totals Summary */}
        {isEnded && (
        <div className="p-5 bg-white rounded-2xl shadow-xl border-2 border-blue-200 mb-6">
            <h2 className="text-lg font-bold text-blue-800 mb-4">Score Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roundPlayers.map(player => {
                    const totals = calculatedScores.playerTotals[player.name] || { grossTotal: 0, netTotal: 0 };
                    const front9 = getFront9Total(player.name);
                    const back9 = getBack9Total(player.name);
                    return (
                        <div key={player.name} className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                            <div className="text-sm font-semibold text-gray-800 mb-3">{player.name}</div>
                            <div className="grid grid-cols-4 gap-3">
                                <div>
                                    <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Out</div>
                                    <div className="text-sm font-bold text-blue-800">{front9}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-gray-600 uppercase mb-1">In</div>
                                    <div className="text-sm font-bold text-blue-800">{back9}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Gross</div>
                                    <div className="text-sm font-bold text-blue-800">{totals.grossTotal || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-gray-600 uppercase mb-1">Net</div>
                                    <div className="text-sm font-bold text-blue-800">{totals.netTotal || '-'}</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
        )}
        </>
    );
};

// --- Main App Component ---

const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [showSplash, setShowSplash] = useState(true);
    const dbReady = !!db;

    // Data States
    const [players, setPlayers] = useState([]);
    const [customBets, setCustomBets] = useState([]);
    const [rounds, setRounds] = useState([]);
    const [courses, setCourses] = useState([]);
    const [activeRoundId, setActiveRoundId] = useState(null);
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [handicapMode, setHandicapMode] = useState('lowest'); // 'lowest' or 'gross'
    const [editingCourseId, setEditingCourseId] = useState(null);
    const [editingCourseHoleData, setEditingCourseHoleData] = useState(null);
    
    // Player editing states
    const [editingPlayerId, setEditingPlayerId] = useState(null);
    const [editingPlayerFirstName, setEditingPlayerFirstName] = useState('');
    const [editingPlayerLastName, setEditingPlayerLastName] = useState('');
    const [editingPlayerHandicap, setEditingPlayerHandicap] = useState('');
    
    // "Me" player selection
    const [myPlayerId, setMyPlayerId] = useState(null);

    // Input States
    const [newPlayerFirstName, setNewPlayerFirstName] = useState('');
    const [newPlayerLastName, setNewPlayerLastName] = useState('');
    const [newPlayerHandicap, setNewPlayerHandicap] = useState('');
    const [newBetName, setNewBetName] = useState('');
    const [newBetType, setNewBetType] = useState(BET_TYPES[0]);
    const [newBetAmount, setNewBetAmount] = useState(5);
    const [newBetCarryOver, setNewBetCarryOver] = useState(true);
    
    // Saved player selection for re-use
    const [selectedExistingPlayerId, setSelectedExistingPlayerId] = useState('');
    // Which saved players are included in the next round's roster
    const [roundPlayerIds, setRoundPlayerIds] = useState([]);
    
    // Team state
    const [teamMode, setTeamMode] = useState('singles'); // 'singles' or 'teams'
    const [teams, setTeams] = useState([]); // [{ id: string, name: string, playerIds: string[] }]
    
    // Round sharing state
    const [shareCodeInput, setShareCodeInput] = useState('');
    const [sharedRound, setSharedRound] = useState(null);
    const [sharedRoundId, setSharedRoundId] = useState(null);
    const [sharedRoundOwnerId, setSharedRoundOwnerId] = useState(null);
    const [isViewingSharedRound, setIsViewingSharedRound] = useState(false);
    const [shareCodeToDisplay, setShareCodeToDisplay] = useState(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isShareCodeErrorModalOpen, setIsShareCodeErrorModalOpen] = useState(false);
    const [sharedRoundCustomBets, setSharedRoundCustomBets] = useState([]);
    
    // View state for bottom navigation
    const [currentView, setCurrentView] = useState('play'); // 'play', 'rounds', 'management', or 'courses'
    
    // Scroll to top when switching to rounds view
    useEffect(() => {
        if (currentView === 'rounds') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [currentView]);
    
    // Set up real-time listener for shared round
    useEffect(() => {
        if (!isViewingSharedRound || !sharedRoundId || !db || !sharedRoundOwnerId) return;
        
        console.log('Setting up real-time listener for shared round', { sharedRoundId, sharedRoundOwnerId });
        
        // Set up real-time listener for the shared round
        const roundRef = doc(db, getRoundCollectionPath(sharedRoundOwnerId), sharedRoundId);
        const unsubscribe = onSnapshot(roundRef, (roundDoc) => {
            if (roundDoc.exists()) {
                const roundData = { id: roundDoc.id, ...roundDoc.data(), ownerUserId: sharedRoundOwnerId };
                
                console.log('Real-time update received for shared round', { 
                    roundId: roundDoc.id, 
                    scores: roundData.scores,
                    timestamp: new Date().toISOString()
                });
                
                // Update shared round state
                setSharedRound(roundData);
                
                // Update all related state in real-time
                const newScores = roundData.scores || {};
                console.log('Updating scores from real-time listener', newScores);
                setScores(newScores);
                setBetSelections(roundData.betSelections || {});
                setHoleDataEdit(roundData.holeData || generateDefaultHoleData());
                setJunkEvents(roundData.junkEvents || {});
                setSelectedJunkTypes(roundData.selectedJunkTypes || []);
                setJunkPointValues(roundData.junkPointValues || {});
                setRoundBets(roundData.roundBets || []);
            }
        }, (error) => {
            console.error('Error listening to shared round:', error);
        });
        
        return () => {
            console.log('Cleaning up real-time listener for shared round');
            unsubscribe();
        };
    }, [isViewingSharedRound, sharedRoundId, db, sharedRoundOwnerId]);
    
    // Fetch master user's custom bets when viewing shared round
    useEffect(() => {
        if (!isViewingSharedRound || !db || !sharedRoundOwnerId) {
            setSharedRoundCustomBets([]);
            return;
        }
        
        const betQuery = collection(db, getBetCollectionPath(sharedRoundOwnerId));
        const unsubscribeBets = onSnapshot(betQuery, (snapshot) => {
            const betList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const cleanedBetList = betList.map(b => ({
                ...b,
                amount: parseFloat(b.amount) || 0,
            }));
            setSharedRoundCustomBets(cleanedBetList);
        }, (error) => {
            console.error("Error fetching shared round custom bets:", error);
            setSharedRoundCustomBets([]);
        });
        
        return () => unsubscribeBets();
    }, [isViewingSharedRound, db, sharedRoundOwnerId]);
    
    // Junk/Side Bets State
    const [selectedJunkTypes, setSelectedJunkTypes] = useState([]);
    
    // Round Bets (on-the-fly bets) State
    const [roundBets, setRoundBets] = useState([]);
    const [newRoundBetName, setNewRoundBetName] = useState('');
    const [newRoundBetType, setNewRoundBetType] = useState('everyone');
    const [newRoundBetAmount, setNewRoundBetAmount] = useState('');
    const [newRoundBetOdds, setNewRoundBetOdds] = useState('');
    const [newRoundBetPlayer1, setNewRoundBetPlayer1] = useState('');
    const [newRoundBetPlayer2, setNewRoundBetPlayer2] = useState('');
    const [junkPointValues, setJunkPointValues] = useState({});
    const [junkEvents, setJunkEvents] = useState({}); // { playerName: { hole1: { greenies: true, sandies: true, ... }, ... } }
    const [newRoundCourseName, setNewRoundCourseName] = useState('');
    const [newCourseName, setNewCourseName] = useState('');

    // UI State
    const [isRoundEndModalOpen, setIsRoundEndModalOpen] = useState(false);
    const finalSummaryRef = useRef(null);

    // Active Round Data States
    const [betSelections, setBetSelections] = useState({});
    const [scores, setScores] = useState({});
    const [holeDataEdit, setHoleDataEdit] = useState(generateDefaultHoleData());

    // Error State for UI feedback
    const [betError, setBetError] = useState(null);

    // Track the round ID that was LAST loaded into the local scores state
    const [lastLoadedScoresRoundId, setLastLoadedScoresRoundId] = useState(null);


    const activeRound = useMemo(() => {
        if (isViewingSharedRound && sharedRound) {
            return sharedRound;
        }
        return rounds.find(r => r.id === activeRoundId);
    }, [rounds, activeRoundId, isViewingSharedRound, sharedRound]);
    
    // Use master user's custom bets when viewing shared round, otherwise use viewer's custom bets
    const allAvailableBets = isViewingSharedRound ? sharedRoundCustomBets : customBets;
    
    // Debounce refs for Firestore writes
    const junkEventSaveTimeoutRef = useRef(null);
    const betSelectionSaveTimeoutRef = useRef(null);
    const scoreSaveTimeoutRef = useRef(null);
    const latestScoresRef = useRef(scores);
    // Track if we have a pending junk event save to prevent onSnapshot from overwriting
    const hasPendingJunkSaveRef = useRef(false);

    // Helper to calculate totals and winners (Memoized)
    const calculatedScores = useMemo(() => {
        const playerTotals = {};
        const holeDataResult = {};
        const roundHoleData = activeRound?.holeData || holeDataEdit || generateDefaultHoleData();
        const roundPlayers = activeRound?.players && activeRound.players.length > 0 ? activeRound.players : players;
        // Store saved players reference for team calculations
        const savedPlayersRef = players;

        let grossWinner = null;
        let minGross = Infinity;
        let netWinner = null;
        let minNet = Infinity;

        // Get handicap mode from round (default to 'lowest' for backward compatibility)
        const roundHandicapMode = activeRound?.handicapMode || 'lowest';
        
        // Calculate adjusted handicaps based on mode
        let adjustedHandicaps = {};
        if (roundHandicapMode === 'lowest') {
            // Find lowest handicap
            const lowestHandicap = Math.min(...roundPlayers.map(p => p.handicap || 0));
            // Adjust all handicaps relative to lowest (lowest becomes 0)
            roundPlayers.forEach(player => {
                adjustedHandicaps[player.name] = (player.handicap || 0) - lowestHandicap;
            });
        } else {
            // Gross mode: use actual handicaps
            roundPlayers.forEach(player => {
                adjustedHandicaps[player.name] = player.handicap || 0;
            });
        }

        roundPlayers.forEach(player => {
            const playerName = player.name;
            const adjustedHandicap = adjustedHandicaps[player.name] || 0;
            const playerScoreData = scores[playerName] || {};

            let grossTotal = 0;
            let netTotal = 0;
            let front9Net = 0;
            let back9Net = 0;

            holeDataResult[playerName] = {};

            HOLE_NUMBERS.forEach(hole => {
                const holeKey = `hole${hole}`;
                const rawScore = parseInt(playerScoreData[holeKey], 10);
                const grossScore = isNaN(rawScore) || rawScore < 1 ? 0 : rawScore;

                // Get course data for this hole (from active round data)
                const holeIndex = parseInt(roundHoleData[holeKey]?.index, 10) || 0;

                // Calculate strokes based on adjusted handicap and hole index
                let strokes = 0;
                if (holeIndex > 0) {
                    strokes = getHandicapStrokesForIndex(adjustedHandicap, holeIndex);
                }

                let netScore = 0;
                if (grossScore > 0) {
                    netScore = Math.max(1, grossScore - strokes);
                    grossTotal += grossScore;
                    netTotal += netScore;
                    
                    // Calculate front 9 (holes 1-9) and back 9 (holes 10-18)
                    if (hole <= 9) {
                        front9Net += netScore;
                    } else {
                        back9Net += netScore;
                    }
                }

                holeDataResult[playerName][holeKey] = { grossScore, strokes, netScore: netScore || '' };
            });

            playerTotals[playerName] = { grossTotal, netTotal, front9Net, back9Net };

            // Determine leaders (only if they have recorded scores)
            if (grossTotal > 0 && grossTotal < minGross) {
                minGross = grossTotal;
                grossWinner = playerName;
            } else if (grossTotal > 0 && grossTotal === minGross) {
                grossWinner = 'Tie';
            }

            if (netTotal > 0 && netTotal < minNet) {
                minNet = netTotal;
                netWinner = playerName;
            } else if (netTotal > 0 && netTotal === minNet) {
                netWinner = 'Tie';
            }
        });

        // Calculate Skins (if Skins bets exist)
        const skinsBets = allAvailableBets.filter(b => b.type === 'Skins');
        const skinsResults = {};
        
        if (skinsBets.length > 0) {
            skinsBets.forEach(bet => {
                const carryOver = bet.carryOver !== false; // Default to true if not specified
                const skinAmount = bet.amount || 0;
                const skinsWon = {};
                let carryOverSkins = 0; // Track number of skins carried over
                
                // Initialize skins won for each player
                roundPlayers.forEach(player => {
                    skinsWon[player.name] = 0;
                });
                
                // Calculate skins for each hole
                HOLE_NUMBERS.forEach(h => {
                    const holeKey = `hole${h}`;
                    const holeScores = {};
                    
                    // Get net scores for this hole
                    roundPlayers.forEach(player => {
                        const netScore = holeDataResult[player.name]?.[holeKey]?.netScore;
                        if (netScore && netScore > 0) {
                            holeScores[player.name] = netScore;
                        }
                    });
                    
                    if (Object.keys(holeScores).length > 0) {
                        const minScore = Math.min(...Object.values(holeScores));
                        const winners = Object.keys(holeScores).filter(name => holeScores[name] === minScore);
                        
                        // If unique winner, award the skin(s) including carry over
                        if (winners.length === 1) {
                            // Award 1 skin for this hole, plus any carry over skins
                            const skinsToAward = 1 + carryOverSkins;
                            skinsWon[winners[0]] += skinsToAward;
                            carryOverSkins = 0; // Reset carry over
                        } else if (winners.length > 1) {
                            // Tie - handle based on carry over setting
                            if (carryOver) {
                                // Carry over to next hole (add 1 skin to carry over)
                                carryOverSkins += 1;
                            } else {
                                // No carry over - skin is lost, reset
                                carryOverSkins = 0;
                            }
                        }
                    }
                });
                
                // Calculate carry over amount for display (dollar value)
                const carryOverAmount = carryOverSkins * skinAmount;
                
                // Calculate total winnings per player (gross winnings)
                const grossWinnings = {};
                roundPlayers.forEach(player => {
                    grossWinnings[player.name] = skinsWon[player.name] * skinAmount;
                });
                
                // For 3 players: Zero-sum calculation
                // Each player is liable for 1/3 of total skins value
                // Winners collect the difference from losers
                const totalWinnings = {};
                if (roundPlayers.length === 3) {
                    // Calculate total value of all skins won
                    const totalSkinsValue = Object.values(grossWinnings).reduce((sum, val) => sum + val, 0);
                    const liabilityPerPlayer = totalSkinsValue / 3;
                    
                    // Net winnings = gross winnings - liability
                    roundPlayers.forEach(player => {
                        const gross = grossWinnings[player.name] || 0;
                        totalWinnings[player.name] = gross - liabilityPerPlayer;
                    });
                } else {
                    // For 2 players: use existing logic (winners get full amount, losers split cost)
                    const winners = roundPlayers.filter(p => grossWinnings[p.name] > 0.01);
                    const losers = roundPlayers.filter(p => grossWinnings[p.name] <= 0.01);
                    
                    if (winners.length > 0 && losers.length > 0) {
                        const totalWon = winners.reduce((sum, p) => sum + grossWinnings[p.name], 0);
                        const amountPerLoser = totalWon / losers.length;
                        
                        roundPlayers.forEach(player => {
                            if (winners.some(w => w.name === player.name)) {
                                // Winner: receives full winnings
                                totalWinnings[player.name] = grossWinnings[player.name];
                            } else {
                                // Loser: owes their share
                                totalWinnings[player.name] = -amountPerLoser;
                            }
                        });
                    } else {
                        // No winners or no losers, use gross winnings
                        roundPlayers.forEach(player => {
                            totalWinnings[player.name] = grossWinnings[player.name] || 0;
                        });
                    }
                }
                
                skinsResults[bet.id] = {
                    skinsWon,
                    totalWinnings,
                    grossWinnings, // Keep gross for display
                    carryOverAmount,
                    amount: skinAmount
                };
            });
        }
        
        // Calculate Nassau winners (if Nassau bets exist)
        const nassauBets = allAvailableBets.filter(b => b.type === 'Nassau');
        const nassauResults = {};
        
        if (nassauBets.length > 0) {
            nassauBets.forEach(bet => {
                const front9Scores = {};
                const back9Scores = {};
                const totalScores = {};
                
                roundPlayers.forEach(player => {
                    const totals = playerTotals[player.name] || {};
                    if (totals.front9Net > 0) front9Scores[player.name] = totals.front9Net;
                    if (totals.back9Net > 0) back9Scores[player.name] = totals.back9Net;
                    if (totals.netTotal > 0) totalScores[player.name] = totals.netTotal;
                });
                
                const amount = bet.amount || 0;
                
                // For 3 players: Individual matchups (A vs B, A vs C, B vs C)
                if (roundPlayers.length === 3) {
                    const playerNames = roundPlayers.map(p => p.name);
                    const matchups = [
                        [playerNames[0], playerNames[1]],
                        [playerNames[0], playerNames[2]],
                        [playerNames[1], playerNames[2]]
                    ];
                    
                    // Calculate matchups for each segment
                    const calculateMatchups = (scoreMap) => {
                        const matchupResults = {};
                        const netWinnings = {};
                        roundPlayers.forEach(p => netWinnings[p.name] = 0);
                        
                        matchups.forEach(([playerA, playerB]) => {
                            const scoreA = scoreMap[playerA];
                            const scoreB = scoreMap[playerB];
                            
                            if (scoreA !== undefined && scoreB !== undefined) {
                                const key = `${playerA}-${playerB}`;
                                if (scoreA < scoreB) {
                                    // Player A wins
                                    matchupResults[key] = { winner: playerA, loser: playerB };
                                    netWinnings[playerA] += amount;
                                    netWinnings[playerB] -= amount;
                                } else if (scoreB < scoreA) {
                                    // Player B wins
                                    matchupResults[key] = { winner: playerB, loser: playerA };
                                    netWinnings[playerB] += amount;
                                    netWinnings[playerA] -= amount;
                                } else {
                                    // Tie
                                    matchupResults[key] = { winner: 'Tie', loser: null };
                                }
                            }
                        });
                        
                        return { matchupResults, netWinnings };
                    };
                    
                    const front9Matchups = calculateMatchups(front9Scores);
                    const back9Matchups = calculateMatchups(back9Scores);
                    const totalMatchups = calculateMatchups(totalScores);
                    
                    // Calculate total net winnings per player (sum of all segments)
                    const totalNetWinnings = {};
                    roundPlayers.forEach(player => {
                        totalNetWinnings[player.name] = 
                            (front9Matchups.netWinnings[player.name] || 0) +
                            (back9Matchups.netWinnings[player.name] || 0) +
                            (totalMatchups.netWinnings[player.name] || 0);
                    });
                    
                    // Calculate "up by" for display (for compatibility with existing UI)
                    const calculateUpBy = (scoreMap, netWinnings) => {
                        const upBy = {};
                        roundPlayers.forEach(player => {
                            const playerScore = scoreMap[player.name];
                            if (playerScore !== undefined) {
                                // Find the best opponent score in matchups
                                let bestOpponentScore = Infinity;
                                matchups.forEach(([pA, pB]) => {
                                    if (player.name === pA && scoreMap[pB] !== undefined) {
                                        bestOpponentScore = Math.min(bestOpponentScore, scoreMap[pB]);
                                    } else if (player.name === pB && scoreMap[pA] !== undefined) {
                                        bestOpponentScore = Math.min(bestOpponentScore, scoreMap[pA]);
                                    }
                                });
                                
                                if (bestOpponentScore !== Infinity) {
                                    upBy[player.name] = bestOpponentScore - playerScore;
                                }
                            }
                        });
                        return upBy;
                    };
                    
                    // Calculate overall winner for each segment (player with highest net winnings)
                    const getSegmentWinner = (netWinnings) => {
                        const entries = Object.entries(netWinnings).filter(([_, net]) => net !== undefined);
                        if (entries.length === 0) return null;
                        const sorted = entries.sort((a, b) => b[1] - a[1]);
                        const maxNet = sorted[0][1];
                        const winners = sorted.filter(([_, net]) => net === maxNet).map(([name]) => name);
                        if (winners.length === 1 && maxNet > 0) return winners[0];
                        if (winners.length > 1 && maxNet > 0) return 'Tie';
                        return null;
                    };
                    
                    nassauResults[bet.id] = {
                        front9Winner: getSegmentWinner(front9Matchups.netWinnings),
                        front9UpBy: calculateUpBy(front9Scores, front9Matchups.netWinnings),
                        back9Winner: getSegmentWinner(back9Matchups.netWinnings),
                        back9UpBy: calculateUpBy(back9Scores, back9Matchups.netWinnings),
                        totalWinner: getSegmentWinner(totalMatchups.netWinnings),
                        totalUpBy: calculateUpBy(totalScores, totalMatchups.netWinnings),
                        amount: amount,
                        isThreePlayer: true,
                        front9Matchups: front9Matchups.matchupResults,
                        back9Matchups: back9Matchups.matchupResults,
                        totalMatchups: totalMatchups.matchupResults,
                        front9NetWinnings: front9Matchups.netWinnings,
                        back9NetWinnings: back9Matchups.netWinnings,
                        totalNetWinnings: totalMatchups.netWinnings,
                        totalNetWinningsPerPlayer: totalNetWinnings
                    };
                } else {
                    // For 2 players: Original logic
                    const findWinnerAndUpBy = (scoreMap) => {
                        if (Object.keys(scoreMap).length === 0) return { winner: null, upBy: {} };
                        const minScore = Math.min(...Object.values(scoreMap));
                        const winners = Object.keys(scoreMap).filter(name => scoreMap[name] === minScore);
                        const winner = winners.length === 1 ? winners[0] : (winners.length > 1 ? 'Tie' : null);
                        
                        const upBy = {};
                        const scores = Object.values(scoreMap).filter(s => s > 0).sort((a, b) => a - b);
                        const leaderScore = scores[0];
                        const secondBestScore = scores.length > 1 ? scores[1] : leaderScore;
                        
                        roundPlayers.forEach(player => {
                            const playerScore = scoreMap[player.name];
                            if (playerScore !== undefined && winner && winner !== 'Tie') {
                                if (player.name === winner) {
                                    upBy[player.name] = secondBestScore - leaderScore;
                                } else {
                                    upBy[player.name] = -(playerScore - leaderScore);
                                }
                            } else if (playerScore !== undefined && winner === 'Tie') {
                                upBy[player.name] = 0;
                            }
                        });
                        
                        return { winner, upBy };
                    };
                    
                    const front9 = findWinnerAndUpBy(front9Scores);
                    const back9 = findWinnerAndUpBy(back9Scores);
                    const total = findWinnerAndUpBy(totalScores);
                    
                    nassauResults[bet.id] = {
                        front9Winner: front9.winner,
                        front9UpBy: front9.upBy,
                        back9Winner: back9.winner,
                        back9UpBy: back9.upBy,
                        totalWinner: total.winner,
                        totalUpBy: total.upBy,
                        amount: amount,
                        isThreePlayer: false
                    };
                }
            });
        }

        // Calculate Match Play (if Match Play bets exist)
        const matchPlayBets = allAvailableBets.filter(b => b.type === 'Match Play');
        const matchPlayResults = {};
        
        if (matchPlayBets.length > 0) {
            matchPlayBets.forEach(bet => {
                const amount = bet.amount || 0;
                
                // Track hole-by-hole wins for each player
                const holeWins = {};
                const matchStatus = {}; // Track "up by" status after each hole
                let matchWonOnHole = null; // Track which hole the match was won on (for early finish)
                roundPlayers.forEach(player => {
                    holeWins[player.name] = 0;
                    matchStatus[player.name] = [];
                });
                
                // Calculate hole-by-hole results
                HOLE_NUMBERS.forEach(hole => {
                    const holeKey = `hole${hole}`;
                    const holeScores = {};
                    
                    // Get net scores for this hole
                    roundPlayers.forEach(player => {
                        const netScore = holeDataResult[player.name]?.[holeKey]?.netScore;
                        if (netScore && netScore > 0) {
                            holeScores[player.name] = netScore;
                        }
                    });
                    
                    if (Object.keys(holeScores).length > 0) {
                        // Find lowest score (winner of the hole)
                        const minScore = Math.min(...Object.values(holeScores));
                        const winners = Object.keys(holeScores).filter(name => holeScores[name] === minScore);
                        
                        if (winners.length === 1) {
                            // Unique winner - they win the hole
                            holeWins[winners[0]]++;
                        }
                        // If tied, hole is halved (no one wins, status remains same)
                    }
                    
                    // Update match status after each hole
                    // For 2 players: track up/down
                    // For 3+ players: track holes won
                    if (roundPlayers.length === 2) {
                        const [playerA, playerB] = roundPlayers;
                        const winsA = holeWins[playerA.name] || 0;
                        const winsB = holeWins[playerB.name] || 0;
                        const upBy = winsA - winsB;
                        matchStatus[playerA.name].push(upBy);
                        matchStatus[playerB.name].push(-upBy);
                        
                        // Check if match was won on this hole (for 2 players)
                        if (matchWonOnHole === null) {
                            const holesRemaining = 18 - hole;
                            // Match ends when one player is up by more holes than remain
                            if (Math.abs(upBy) > holesRemaining && holesRemaining > 0) {
                                matchWonOnHole = hole;
                            }
                        }
                    } else {
                        // For 3+ players, track holes won
                        roundPlayers.forEach(player => {
                            matchStatus[player.name].push(holeWins[player.name] || 0);
                        });
                    }
                });
                
                // Determine overall match winner
                let matchWinner = null;
                let matchResult = null;
                
                if (roundPlayers.length === 2) {
                    const [playerA, playerB] = roundPlayers;
                    const winsA = holeWins[playerA.name] || 0;
                    const winsB = holeWins[playerB.name] || 0;
                    const upBy = winsA - winsB;
                    
                    if (upBy > 0) {
                        matchWinner = playerA.name;
                        // Calculate match result
                        if (matchWonOnHole !== null) {
                            // Match ended early (e.g., "3 & 2")
                            const holesRemaining = 18 - matchWonOnHole;
                            matchResult = `${upBy} & ${holesRemaining}`;
                        } else {
                            // Match went all 18 holes
                            matchResult = `${upBy} up`;
                        }
                    } else if (upBy < 0) {
                        matchWinner = playerB.name;
                        if (matchWonOnHole !== null) {
                            const holesRemaining = 18 - matchWonOnHole;
                            matchResult = `${Math.abs(upBy)} & ${holesRemaining}`;
                        } else {
                            matchResult = `${Math.abs(upBy)} up`;
                        }
                    } else {
                        matchWinner = 'Tie';
                        matchResult = 'All Square';
                    }
                } else {
                    // For 3+ players: winner is player with most holes won
                    const sortedPlayers = roundPlayers
                        .map(p => ({ name: p.name, wins: holeWins[p.name] || 0 }))
                        .sort((a, b) => b.wins - a.wins);
                    
                    if (sortedPlayers.length > 0) {
                        const maxWins = sortedPlayers[0].wins;
                        const winners = sortedPlayers.filter(p => p.wins === maxWins);
                        
                        if (winners.length === 1 && maxWins > 0) {
                            matchWinner = winners[0].name;
                            matchResult = `${maxWins} holes won`;
                        } else if (winners.length > 1 && maxWins > 0) {
                            matchWinner = 'Tie';
                            matchResult = `${maxWins} holes (Tied)`;
                        } else {
                            matchWinner = null;
                            matchResult = 'No winner';
                        }
                    }
                }
                
                // Calculate net winnings
                const netWinnings = {};
                roundPlayers.forEach(player => {
                    netWinnings[player.name] = 0;
                });
                
                // Check if we're in team mode
                const isTeamMode = activeRound?.teamMode === 'teams' && activeRound?.teams && activeRound.teams.length > 0;
                
                if (matchWinner && matchWinner !== 'Tie' && matchWinner !== 'No winner') {
                    if (isTeamMode && activeRound.teams) {
                        // Team mode: Calculate team-level winnings
                        // Determine which team won based on holes won
                        const teamHolesWon = {};
                        activeRound.teams.forEach(team => {
                            const teamPlayerNames = team.playerIds
                                .map(playerId => {
                                    const savedPlayer = savedPlayersRef.find(sp => sp.id === playerId);
                                    return savedPlayer ? savedPlayer.name : null;
                                })
                                .filter(name => name !== null);
                            
                            const totalHolesWon = teamPlayerNames.reduce((sum, playerName) => {
                                return sum + (holeWins[playerName] || 0);
                            }, 0);
                            teamHolesWon[team.name] = { totalHolesWon, playerNames: teamPlayerNames };
                        });
                        
                        // Find winning team (team with most holes won)
                        const teamEntries = Object.entries(teamHolesWon);
                        if (teamEntries.length >= 2) {
                            teamEntries.sort((a, b) => b[1].totalHolesWon - a[1].totalHolesWon);
                            const winningTeam = teamEntries[0];
                            const losingTeams = teamEntries.slice(1);
                            
                            // Only proceed if there's a clear winner (not a tie)
                            if (winningTeam[1].totalHolesWon > (teamEntries[1]?.[1]?.totalHolesWon || 0)) {
                                // Winning team gets bet amount, split equally among team members
                                const winningTeamPlayerCount = winningTeam[1].playerNames.length;
                                const winningsPerPlayer = amount / winningTeamPlayerCount;
                                winningTeam[1].playerNames.forEach(playerName => {
                                    netWinnings[playerName] = winningsPerPlayer;
                                });
                                
                                // Losing teams pay the bet amount, split equally among team members
                                losingTeams.forEach(([teamName, teamData]) => {
                                    const losingTeamPlayerCount = teamData.playerNames.length;
                                    const lossPerPlayer = -amount / losingTeamPlayerCount;
                                    teamData.playerNames.forEach(playerName => {
                                        netWinnings[playerName] = lossPerPlayer;
                                    });
                                });
                            }
                        }
                    } else {
                        // Singles mode: Original logic
                        if (roundPlayers.length === 2) {
                            // Winner gets bet amount from loser
                            const loser = roundPlayers.find(p => p.name !== matchWinner);
                            if (loser) {
                                netWinnings[matchWinner] = amount;
                                netWinnings[loser.name] = -amount;
                            }
                        } else {
                            // For 3+ players: winner gets bet amount from each loser
                            const losers = roundPlayers.filter(p => p.name !== matchWinner);
                            const totalWinnings = losers.length * amount;
                            netWinnings[matchWinner] = totalWinnings;
                            losers.forEach(loser => {
                                netWinnings[loser.name] = -amount;
                            });
                        }
                    }
                }
                // If tie, no money changes hands
                
                matchPlayResults[bet.id] = {
                    holeWins,
                    matchStatus,
                    matchWinner,
                    matchResult,
                    netWinnings,
                    amount: amount
                };
            });
        }

        // Calculate 9 Point (if 9 Point bets exist and exactly 3 players)
        const ninePointBets = allAvailableBets.filter(b => b.type === '9 Point');
        const ninePointResults = {};
        
        if (ninePointBets.length > 0 && roundPlayers.length === 3) {
            ninePointBets.forEach(bet => {
                const pointAmount = bet.amount || 0;
                const pointsWon = {};
                const holePoints = {}; // Track points per hole for display
                
                // Initialize points won for each player
                roundPlayers.forEach(player => {
                    pointsWon[player.name] = 0;
                });
                
                // Calculate points for each hole
                HOLE_NUMBERS.forEach(h => {
                    const holeKey = `hole${h}`;
                    const holeScores = {};
                    
                    // Get net scores for this hole
                    roundPlayers.forEach(player => {
                        const netScore = holeDataResult[player.name]?.[holeKey]?.netScore;
                        if (netScore && netScore > 0) {
                            holeScores[player.name] = netScore;
                        }
                    });
                    
                    if (Object.keys(holeScores).length === 3) {
                        // All 3 players have scores for this hole
                        const scores = Object.values(holeScores);
                        const minScore = Math.min(...scores);
                        const maxScore = Math.max(...scores);
                        const scoreCounts = {};
                        
                        // Count occurrences of each score
                        Object.entries(holeScores).forEach(([name, score]) => {
                            scoreCounts[score] = (scoreCounts[score] || []).concat(name);
                        });
                        
                        const winners = scoreCounts[minScore] || [];
                        const losers = scoreCounts[maxScore] || [];
                        
                        let holePointsDistribution = {};
                        
                        // Check for Blitz: winner must beat BOTH other players by 2+ strokes
                        if (winners.length === 1) {
                            const winnerName = winners[0];
                            const winnerScore = minScore;
                            const otherScores = Object.entries(holeScores)
                                .filter(([name]) => name !== winnerName)
                                .map(([, score]) => score);
                            
                            // Check if winner beats both other players by 2+ strokes
                            const beatsBothBy2Plus = otherScores.every(score => score - winnerScore >= 2);
                            
                            if (beatsBothBy2Plus) {
                                // Blitz: Winner gets all 9 points
                                holePointsDistribution[winnerName] = 9;
                                roundPlayers.forEach(player => {
                                    if (player.name !== winnerName) {
                                        holePointsDistribution[player.name] = 0;
                                    }
                                });
                            } else {
                                // Not a blitz, continue with normal scoring logic below
                                // This will be handled by the else-if chain
                            }
                        }
                        
                        // If not a blitz, check other scenarios
                        if (Object.keys(holePointsDistribution).length === 0) {
                            if (winners.length === 3) {
                                // Three-way tie: 3 points each
                                roundPlayers.forEach(player => {
                                    holePointsDistribution[player.name] = 3;
                                });
                            } else if (winners.length === 1 && losers.length === 2) {
                                // One winner, two tied: Winner gets 5, tied get 2 each
                                holePointsDistribution[winners[0]] = 5;
                                losers.forEach(loser => {
                                    holePointsDistribution[loser] = 2;
                                });
                            } else if (winners.length === 2 && losers.length === 1) {
                                // Two tied, one loser: Tied get 4 each, loser gets 1
                                winners.forEach(winner => {
                                    holePointsDistribution[winner] = 4;
                                });
                                holePointsDistribution[losers[0]] = 1;
                            } else {
                                // Fallback: should not happen, but handle gracefully
                                roundPlayers.forEach(player => {
                                    holePointsDistribution[player.name] = 3;
                                });
                            }
                        }
                        
                        // Add points to totals
                        Object.entries(holePointsDistribution).forEach(([name, points]) => {
                            pointsWon[name] = (pointsWon[name] || 0) + points;
                        });
                        
                        // Store hole points for display
                        holePoints[h] = holePointsDistribution;
                    }
                });
                
                // Calculate winnings: Each point is worth pointAmount
                // For 3 players, this is zero-sum: total points = 9 * 18 = 162 points
                // Each player's liability = (162 * pointAmount) / 3 = 54 * pointAmount
                const totalHoles = HOLE_NUMBERS.filter(h => {
                    const holeKey = `hole${h}`;
                    return roundPlayers.every(p => holeDataResult[p.name]?.[holeKey]?.netScore > 0);
                }).length;
                
                const totalPointsValue = totalHoles * 9 * pointAmount;
                const liabilityPerPlayer = totalPointsValue / 3;
                
                // Calculate net winnings
                const netWinnings = {};
                roundPlayers.forEach(player => {
                    const grossWinnings = (pointsWon[player.name] || 0) * pointAmount;
                    netWinnings[player.name] = grossWinnings - liabilityPerPlayer;
                });
                
                ninePointResults[bet.id] = {
                    pointsWon,
                    holePoints,
                    netWinnings,
                    grossWinnings: Object.fromEntries(
                        roundPlayers.map(p => [p.name, (pointsWon[p.name] || 0) * pointAmount])
                    ),
                    amount: pointAmount,
                    totalHoles
                };
            });
        }

        return { playerTotals, holeData: holeDataResult, players: roundPlayers, grossWinner, netWinner, nassauResults, skinsResults, matchPlayResults, ninePointResults };
    }, [activeRound, players, scores, holeDataEdit, allAvailableBets]);


    // Function to generate the empty bet winners structure
    const generateInitialBetSelections = useCallback((bets) => {
        const initialSelections = {};
        // Only include manual bets in initial selections (exclude Skins, Nassau, and Match Play which are auto-calculated)
        bets.filter(b => b.type !== 'Skins' && b.type !== 'Nassau' && b.type !== 'Match Play' && b.type !== '9 Point').forEach(bet => {
            initialSelections[bet.name] = ''; // Stores winner name (string)
        });
        return initialSelections;
    }, []);

    // Function to generate the empty scores structure
    const generateInitialScores = useCallback((playerList) => {
        const initialScores = {};
        playerList.forEach(player => {
            initialScores[player.name] = {};
            HOLE_NUMBERS.forEach(h => {
                initialScores[player.name][`hole${h}`] = '';
            });
        });
        return initialScores;
    }, []);


    // 1. Firebase Initialization and Authentication
    useEffect(() => {
        try {
            // Use the already-initialized Firebase instances from firebase.js
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    setUserId(null);
                }
                setIsAuthReady(true);
            });

            return () => unsubscribe();
        } catch (error) {
            handleError("Firebase initialization failed:", error);
        }
    }, []);

    // Save selectedJunkTypes and junkPointValues to active round (debounced)
    useEffect(() => {
        if (!db || !userId || !activeRoundId) return;
        
        // Debounce the save to prevent too many rapid writes
        const timeoutId = setTimeout(() => {
            const roundRef = doc(db, getRoundCollectionPath(userId), activeRoundId);
            updateDoc(roundRef, {
                selectedJunkTypes: selectedJunkTypes,
                junkPointValues: junkPointValues,
                lastUpdated: serverTimestamp(),
            }).catch(error => {
                // Silently ignore throttling/rate limiting errors
                if (!error.message?.includes('backoff') && 
                    !error.code?.includes('resource-exhausted') &&
                    !error.code?.includes('unavailable')) {
                    handleError("Failed to save junk settings:", error);
                }
            });
        }, 3000); // Wait 3 seconds after last change to reduce Firestore writes
        
        return () => clearTimeout(timeoutId);
    }, [db, userId, activeRoundId, selectedJunkTypes, junkPointValues]);

    // 2. Data Fetching (Players, Custom Bets, and Rounds)
    useEffect(() => {
        if (!isAuthReady || !userId || !db) return;

        // Fetch Custom Bets
        const betQuery = collection(db, getBetCollectionPath(userId));
        const unsubscribeBets = onSnapshot(betQuery, (snapshot) => {
            const betList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const cleanedBetList = betList.map(b => ({
                ...b,
                amount: parseFloat(b.amount) || 0,
            }));
            setCustomBets(cleanedBetList);
            setBetError(null);
        }, (error) => {
            handleError("Error fetching custom bets:", error);
            setBetError(error);
        });

        // Fetch Players
        const playerQuery = collection(db, getPlayerCollectionPath(userId));
        const unsubscribePlayers = onSnapshot(playerQuery, (snapshot) => {
            const playerList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPlayers(playerList);

            // Keep roundPlayerIds in sync with saved players, but don't add/remove
            // if the user has already customized the round roster.
            setRoundPlayerIds(prevIds => {
                if (!prevIds || prevIds.length === 0) {
                    // Default: all saved players are in the round
                    return playerList.map(p => p.id);
                }
                const validIds = new Set(playerList.map(p => p.id));
                return prevIds.filter(id => validIds.has(id));
            });

        }, (error) => handleError("Error fetching players:", error));

        // Fetch Rounds (Fix for preserving local scores is here)
        const roundQuery = collection(db, getRoundCollectionPath(userId));
        const unsubscribeRounds = onSnapshot(roundQuery, async (snapshot) => {
            const roundList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Ensure all rounds have share codes
            const roundsToUpdate = [];
            for (const round of roundList) {
                if (!round.shareCode) {
                    const shareCode = generateShareCode();
                    roundsToUpdate.push({ roundId: round.id, shareCode });
                }
            }
            
            // Update rounds that don't have share codes
            for (const { roundId, shareCode } of roundsToUpdate) {
                try {
                    const roundRef = doc(db, getRoundCollectionPath(userId), roundId);
                    await updateDoc(roundRef, {
                        shareCode: shareCode,
                        lastUpdated: serverTimestamp(),
                    });
                    
                    // Create shared round entry
                    await addDoc(collection(db, SHARED_ROUNDS_COLLECTION), {
                        shareCode: shareCode,
                        userId: userId,
                        roundId: roundId,
                        createdAt: serverTimestamp(),
                    });
                } catch (error) {
                    console.error(`Failed to add share code to round ${roundId}:`, error);
                }
            }
            
            setRounds(roundList);

            const currentActiveRound = roundList.find(r => r.id === activeRoundId);

            if (currentActiveRound) {
                // Only update bet selections when round changes or ends (preserve local edits)
                const isNewRoundSelected = activeRoundId !== lastLoadedScoresRoundId;
                const isRoundEnded = currentActiveRound.status === 'Ended';
                
                if (isNewRoundSelected || isRoundEnded) {
                    setBetSelections(currentActiveRound.betSelections || {});
                    setRoundBets(currentActiveRound.roundBets || []);
                }
                
                // Always update hole data in real-time
                setHoleDataEdit(currentActiveRound.holeData || generateDefaultHoleData());
                
                // Load Junk data
                setSelectedJunkTypes(currentActiveRound.selectedJunkTypes || []);
                setJunkPointValues(currentActiveRound.junkPointValues || {});
                
                // Load Teams data (only when explicitly selecting a new round or round ended)
                // Don't overwrite local team edits when user is actively setting up teams
                // Only update from Firestore if it's a new round or the round ended
                if (isNewRoundSelected || isRoundEnded) {
                    const firestoreTeamMode = currentActiveRound.teamMode || 'singles';
                    const firestoreTeams = currentActiveRound.teams || [];
                    setTeamMode(firestoreTeamMode);
                    setTeams(firestoreTeams);
                }
                // If not a new round and not ended, preserve local team edits

                // Only hydrate junkEvents from Firestore when first loading / changing the round
                // to avoid overwriting in-progress local checkbox edits while debounced saves run.
                const isJunkEmpty = Object.keys(junkEvents || {}).length === 0;
                const hasPendingSave = hasPendingJunkSaveRef.current;
                
                // Only update from Firestore if:
                // 1. New round selected (need to load initial data)
                // 2. Round ended (need to load final data)
                // 3. Junk is empty (initial load)
                // 4. No pending save AND data is different (safe to sync)
                if (isNewRoundSelected || isRoundEnded || isJunkEmpty) {
                    setJunkEvents(currentActiveRound.junkEvents || {});
                } else if (!hasPendingSave) {
                    // Only sync if no pending save and data is different
                    const firestoreJunkEvents = currentActiveRound.junkEvents || {};
                    const currentJunkEvents = junkEvents || {};
                    const isDifferent = JSON.stringify(firestoreJunkEvents) !== JSON.stringify(currentJunkEvents);
                    
                    if (isDifferent) {
                        setJunkEvents(firestoreJunkEvents);
                    }
                }
                // If hasPendingSave is true, skip update to preserve local edits

                // --- Conditional Score Loading (Ensures final scores are loaded on END) ---
                const isScoresEmpty = Object.keys(scores).length === 0;

                if (isNewRoundSelected || isRoundEnded || isScoresEmpty) {
                     const loadedScores = currentActiveRound.scores || {};
                     setScores(loadedScores);
                     latestScoresRef.current = loadedScores;
                     setLastLoadedScoresRoundId(currentActiveRound.id);
                }
            }
        }, (error) => handleError("Error fetching rounds:", error));

        // Fetch Courses
        const courseQuery = collection(db, getCourseCollectionPath(userId));
        const unsubscribeCourses = onSnapshot(courseQuery, (snapshot) => {
            const courseList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCourses(courseList);
        }, (error) => handleError("Error fetching courses:", error));


        return () => {
            unsubscribeBets();
            unsubscribePlayers();
            unsubscribeRounds();
            unsubscribeCourses();
        };
    }, [isAuthReady, userId, db, activeRoundId, lastLoadedScoresRoundId]);

    // Load user settings (including myPlayerId)
    useEffect(() => {
        if (!isAuthReady || !userId || !db) return;

        const userRef = doc(db, getUserDocumentPath(userId));
        getDoc(userRef).then((docSnap) => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                if (userData.myPlayerId) {
                    setMyPlayerId(userData.myPlayerId);
                }
            }
        }).catch((error) => {
            handleError("Error loading user settings:", error);
        });
    }, [isAuthReady, userId, db]);


    // --- Round Management and Finalization ---

    const handleStartNewRound = async () => {
        const rosterPlayers = roundPlayerIds.length > 0
            ? players.filter(p => roundPlayerIds.includes(p.id))
            : players;

        if (!db || !userId || rosterPlayers.length === 0) {
             console.log("Cannot start round: Player list is empty.");
             alert("Please add at least one player to start a new round.");
             return;
        }
        
        if (!selectedCourseId) {
             console.log("Cannot start round: Course selection is required.");
             alert("Please select a course to start a new round.");
             return;
        }

        try {
            // 1. Get course name from selected course
            const selectedCourse = courses.find(c => c.id === selectedCourseId);
            const courseName = selectedCourse ? selectedCourse.name : 'Unspecified Course';
            
            // 2. Generate fresh data structures
            const initialRoundBetWinners = generateInitialBetSelections(allAvailableBets);
            const initialRoundScores = generateInitialScores(rosterPlayers);
            // Use current holeDataEdit if available (from selected course or previous edits), otherwise use default
            const initialHoleData = Object.keys(holeDataEdit).length > 0 && 
                HOLE_NUMBERS.every(h => holeDataEdit[`hole${h}`]) 
                ? holeDataEdit 
                : generateDefaultHoleData();

            // 3. Generate share code
            const shareCode = generateShareCode();
            
            // 4. Create New Round
            const newRoundRef = await addDoc(collection(db, getRoundCollectionPath(userId)), {
                date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
                courseName: courseName,
                players: rosterPlayers.map(p => ({ name: p.name, handicap: p.handicap || 0 })),
                status: 'Active',
                betSelections: initialRoundBetWinners,
                scores: initialRoundScores,
                holeData: initialHoleData, // Use selected course data or default
                selectedJunkTypes: selectedJunkTypes || [],
                junkPointValues: junkPointValues || {},
                junkEvents: {},
                handicapMode: handicapMode || 'lowest', // Store handicap calculation mode
                teamMode: teamMode || 'singles', // Store team mode
                teams: teamMode === 'teams' ? teams : [], // Store teams if in teams mode
                shareCode: shareCode, // Store share code
                createdAt: serverTimestamp(),
            });
            
            // 5. Create shared round entry for code lookup
            await addDoc(collection(db, SHARED_ROUNDS_COLLECTION), {
                shareCode: shareCode,
                userId: userId,
                roundId: newRoundRef.id,
                createdAt: serverTimestamp(),
            });

            // 6. Update local state
            setActiveRoundId(newRoundRef.id);
            setBetSelections(initialRoundBetWinners);
            setScores(initialRoundScores);
            setHoleDataEdit(initialHoleData);
            setJunkEvents({}); // Clear junk checkboxes
            setSelectedCourseId(''); // Clear course selection
            setLastLoadedScoresRoundId(newRoundRef.id);
            // Reset teams when starting new round
            setTeamMode('singles');
            setTeams([]);
            // Switch to rounds view when starting a new round
            setCurrentView('rounds');
        } catch (error) {
            handleError("Failed to start new round:", error);
        }
    };

    const handleSelectRound = (roundId) => {
        setActiveRoundId(roundId);
        // Auto-switch to rounds view when selecting a round
        setCurrentView('rounds');
        setIsViewingSharedRound(false);
        setSharedRound(null);
        setSharedRoundId(null);
        setSharedRoundOwnerId(null);
        // Scroll to top of the page
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    // Handle entering share code to view shared round
    const handleEnterShareCode = async () => {
        if (!db || !shareCodeInput.trim()) return;
        
        const code = shareCodeInput.trim().toUpperCase();
        if (code.length !== 4) {
            alert('Share code must be 4 characters');
            return;
        }
        
        try {
            // Look up the share code in shared_rounds collection
            const sharedRoundsQuery = query(
                collection(db, SHARED_ROUNDS_COLLECTION),
                where('shareCode', '==', code)
            );
            const querySnapshot = await getDocs(sharedRoundsQuery);
            
            if (querySnapshot.empty) {
                setIsShareCodeErrorModalOpen(true);
                return;
            }
            
            const sharedRoundDoc = querySnapshot.docs[0];
            const sharedRoundData = sharedRoundDoc.data();
            const { userId: ownerUserId, roundId } = sharedRoundData;
            
            // Fetch the actual round data
            const roundRef = doc(db, getRoundCollectionPath(ownerUserId), roundId);
            const roundDoc = await getDoc(roundRef);
            
            if (!roundDoc.exists()) {
                setIsShareCodeErrorModalOpen(true);
                return;
            }
            
            const roundData = { id: roundDoc.id, ...roundDoc.data(), ownerUserId: ownerUserId };
            
            // Store ownerUserId separately for the listener
            setSharedRoundOwnerId(ownerUserId);
            
            // Set as shared round
            setSharedRound(roundData);
            setSharedRoundId(roundDoc.id);
            setIsViewingSharedRound(true);
            setShareCodeInput('');
            setCurrentView('rounds');
            
            // Initialize state from the round data
            setScores(roundData.scores || {});
            setBetSelections(roundData.betSelections || {});
            setHoleDataEdit(roundData.holeData || generateDefaultHoleData());
            setJunkEvents(roundData.junkEvents || {});
            setSelectedJunkTypes(roundData.selectedJunkTypes || []);
            setJunkPointValues(roundData.junkPointValues || {});
            setRoundBets(roundData.roundBets || []);
        } catch (error) {
            handleError('Failed to load shared round:', error);
            alert('Failed to load shared round. Please try again.');
        }
    };
    
    // Generate share code for existing round (if it doesn't have one)
    const handleGenerateShareCode = async (roundId) => {
        if (!db || !userId || !roundId) return;
        
        try {
            const roundRef = doc(db, getRoundCollectionPath(userId), roundId);
            const roundDoc = await getDoc(roundRef);
            
            if (!roundDoc.exists()) {
                alert('Round not found');
                return;
            }
            
            const roundData = roundDoc.data();
            
            // If round already has a share code, just display it
            if (roundData.shareCode) {
                setShareCodeToDisplay(roundData.shareCode);
                return;
            }
            
            // Generate new share code
            const shareCode = generateShareCode();
            
            // Update round with share code
            await updateDoc(roundRef, {
                shareCode: shareCode,
                lastUpdated: serverTimestamp(),
            });
            
            // Create shared round entry
            await addDoc(collection(db, SHARED_ROUNDS_COLLECTION), {
                shareCode: shareCode,
                userId: userId,
                roundId: roundId,
                createdAt: serverTimestamp(),
            });
            
            setShareCodeToDisplay(shareCode);
        } catch (error) {
            handleError('Failed to generate share code:', error);
            alert('Failed to generate share code. Please try again.');
        }
    };

    // Hole Data Editor Handlers
    const handleEndRound = async () => {
        console.log("handleEndRound called", { db: !!db, userId: !!userId, activeRoundId, activeRound: !!activeRound, calculatedScores: !!calculatedScores });
        
        // Check if round is already ended
        if (activeRound && activeRound.status === 'Ended') {
            alert("This round is already ended.");
            return;
        }
        
        if (!db || !userId || !activeRoundId || !activeRound) {
            const errorMsg = `Cannot end round - missing required data: db=${!!db}, userId=${!!userId}, activeRoundId=${activeRoundId}, activeRound=${!!activeRound}`;
            console.error(errorMsg);
            alert(errorMsg);
            return;
        }

        if (!calculatedScores || !calculatedScores.players || calculatedScores.players.length === 0) {
            const errorMsg = "Cannot end round: No players found in calculated scores. Please ensure players are added and scores are entered.";
            console.error(errorMsg, calculatedScores);
            alert(errorMsg);
            return;
        }

        // --- STEP 1: Ensure scores are saved before finalizing status ---
        // Note: holeData is already stored in the round when it was created/loaded
        try {
            const roundRef = doc(db, getRoundCollectionPath(userId), activeRoundId);
             await updateDoc(roundRef, {
                scores: scores, // Final scores from local state
                lastUpdated: serverTimestamp(),
            });
            console.log("Final scores saved pre-finalization.");
        } catch (error) {
            handleError("Failed to save final round scores:", error);
        }

        const playerNames = calculatedScores.players.map(p => p.name);
        const winnings = {};
        playerNames.forEach(name => winnings[name] = 0);
        let skinsWon = {}; // Initialize skins won tracker

        // --- STEP 2: Calculate Bet Winnings ---
        // This section calculates individual player winnings from ALL bet types.
        // In teams mode, these individual winnings are then aggregated by team in STEP 3.

        // 2a. Standard/Manual Bets (User selected winner)
        // Note: Skins, Nassau, and Match Play are excluded here as they're auto-calculated below
        Object.entries(betSelections).forEach(([betKey, winnerName]) => {
            if (winnerName && winnerName !== 'N/A') {
                // Check if it's a round bet (on-the-fly bet)
                const roundBet = (roundBets || []).find(b => b.id === betKey);
                if (roundBet) {
                    // Handle round bet with odds
                    if (roundBet.betType === 'twoPlayers') {
                        // Two-player bet with odds logic:
                        // If Player 1 wins: Player 1 gets base amount, Player 2 pays base amount
                        // If Player 2 wins: Player 2 gets odds amount, Player 1 pays odds amount
                        if (winnerName === roundBet.player1) {
                            // Player 1 wins - they get base amount, Player 2 pays base amount
                            winnings[roundBet.player1] = (winnings[roundBet.player1] || 0) + roundBet.amount;
                            winnings[roundBet.player2] = (winnings[roundBet.player2] || 0) - roundBet.amount;
                        } else if (winnerName === roundBet.player2) {
                            // Player 2 wins - they get odds amount, Player 1 pays odds amount
                            winnings[roundBet.player2] = (winnings[roundBet.player2] || 0) + roundBet.odds;
                            winnings[roundBet.player1] = (winnings[roundBet.player1] || 0) - roundBet.odds;
                        }
                    } else {
                        // For "everyone" bets, winner gets amount, losers split the cost
                        const loserAmount = roundBet.odds || roundBet.amount;
                        winnings[winnerName] = (winnings[winnerName] || 0) + roundBet.amount;
                        const losers = playerNames.filter(name => name !== winnerName);
                        const costPerLoser = loserAmount / (losers.length || 1);
                        losers.forEach(loser => {
                            winnings[loser] = (winnings[loser] || 0) - costPerLoser;
                        });
                    }
                } else {
                    // Regular custom bet
                    const bet = allAvailableBets.find(b => b.name === betKey);
                    // Exclude auto-calculated bet types (Skins, Nassau, Match Play, 9 Point)
                    if (bet && bet.type !== 'Skins' && bet.type !== 'Nassau' && bet.type !== 'Match Play' && bet.type !== '9 Point') {
                        winnings[winnerName] = (winnings[winnerName] || 0) + bet.amount;
                    }
                }
            }
        });

        // 2b. Nassau Calculation (Automatic)
        const nassauBets = allAvailableBets.filter(b => b.type === 'Nassau');
        const nassauResults = calculatedScores.nassauResults || {};

        if (nassauBets.length > 0) {
            nassauBets.forEach(bet => {
                const result = nassauResults[bet.id];
                if (result) {
                    if (result.isThreePlayer && result.totalNetWinningsPerPlayer) {
                        // For 3 players: use net winnings from individual matchups
                        playerNames.forEach(name => {
                            const netWinnings = result.totalNetWinningsPerPlayer[name] || 0;
                            winnings[name] = (winnings[name] || 0) + netWinnings;
                        });
                    } else {
                        // For 2 players: original logic
                        const amount = bet.amount || 0;
                        // Front 9 winner
                        if (result.front9Winner && result.front9Winner !== 'Tie') {
                            winnings[result.front9Winner] = (winnings[result.front9Winner] || 0) + amount;
                        }
                        // Back 9 winner
                        if (result.back9Winner && result.back9Winner !== 'Tie') {
                            winnings[result.back9Winner] = (winnings[result.back9Winner] || 0) + amount;
                        }
                        // Total winner
                        if (result.totalWinner && result.totalWinner !== 'Tie') {
                            winnings[result.totalWinner] = (winnings[result.totalWinner] || 0) + amount;
                        }
                    }
                }
            });
        }

        // 2c. Skins Calculation (Automatic) - Use pre-calculated results with carry over logic
        const skinsBets = allAvailableBets.filter(b => b.type === 'Skins');
        const skinsResults = calculatedScores.skinsResults || {};

        if (skinsBets.length > 0) {
            // Use the calculated skins results which already handle carry over and zero-sum
            skinsBets.forEach(bet => {
                const result = skinsResults[bet.id];
                if (result) {
                    // Add Skins Winnings to total winnings (includes negative for losers in zero-sum)
                    playerNames.forEach(name => {
                        const totalSkinsWon = result.skinsWon[name] || 0;
                        const skinWinnings = result.totalWinnings[name] || 0;
                        // Include all players, even if they have negative winnings (zero-sum)
                        winnings[name] = (winnings[name] || 0) + skinWinnings;
                        skinsWon[name] = (skinsWon[name] || 0) + totalSkinsWon;
                    });
                }
            });
        }

        // 2d. Match Play Calculation (Automatic)
        const matchPlayBets = allAvailableBets.filter(b => b.type === 'Match Play');
        const matchPlayResults = calculatedScores.matchPlayResults || {};

        if (matchPlayBets.length > 0) {
            matchPlayBets.forEach(bet => {
                const result = matchPlayResults[bet.id];
                if (result && result.netWinnings) {
                    // Add Match Play winnings to total winnings
                    playerNames.forEach(name => {
                        const matchPlayWinnings = result.netWinnings[name] || 0;
                        winnings[name] = (winnings[name] || 0) + matchPlayWinnings;
                    });
                }
            });
        }

        // 2e. 9 Point Calculation (Automatic) - Only for 3 players
        const ninePointBets = allAvailableBets.filter(b => b.type === '9 Point');
        const ninePointResults = calculatedScores.ninePointResults || {};

        if (ninePointBets.length > 0 && playerNames.length === 3) {
            ninePointBets.forEach(bet => {
                const result = ninePointResults[bet.id];
                if (result && result.netWinnings) {
                    // Add 9 Point winnings to total winnings
                    playerNames.forEach(name => {
                        const ninePointWinnings = result.netWinnings[name] || 0;
                        winnings[name] = (winnings[name] || 0) + ninePointWinnings;
                    });
                }
            });
        }

        // 2f. Junk/Side Bets Calculation
        const junkWinnings = {};
        playerNames.forEach(name => junkWinnings[name] = 0);
        
        if (selectedJunkTypes && selectedJunkTypes.length > 0 && junkEvents) {
            selectedJunkTypes.forEach(junkId => {
                const pointValue = junkPointValues[junkId] || 1;
                const isLosingDots = junkId === 'losingDots';
                playerNames.forEach(name => {
                    let count = 0;
                    HOLE_NUMBERS.forEach(h => {
                        const holeKey = `hole${h}`;
                        if (junkEvents[name]?.[holeKey]?.[junkId]) {
                            count++;
                        }
                    });
                    // Losing dots subtract, all others add
                    const points = isLosingDots 
                        ? -(count * pointValue) 
                        : (count * pointValue);
                    junkWinnings[name] = (junkWinnings[name] || 0) + points;
                    winnings[name] = (winnings[name] || 0) + points;
                });
            });
        }

        // --- STEP 3: Aggregate by Team if in Teams Mode ---
        // At this point, 'winnings' contains individual player totals from ALL bet types:
        // - Manual/Standard bets (2a)
        // - Nassau (2b)
        // - Skins (2c)
        // - Match Play (2d)
        // - Junk/Side bets (2e)
        // If in teams mode, sum each team's players' individual winnings to get team totals.
        let finalWinnings = winnings;
        let teamWinnings = {};
        
        if (activeRound.teamMode === 'teams' && activeRound.teams && activeRound.teams.length > 0) {
            // Aggregate individual player winnings by team
            activeRound.teams.forEach(team => {
                // Get player names from saved players by matching IDs
                const teamPlayerNames = team.playerIds
                    .map(playerId => {
                        const savedPlayer = players.find(sp => sp.id === playerId);
                        return savedPlayer ? savedPlayer.name : null;
                    })
                    .filter(name => name !== null);
                
                // Sum ALL winnings for all players in this team
                // This includes: manual bets + Nassau + Skins + Match Play + Junk
                const teamTotal = teamPlayerNames.reduce((sum, playerName) => {
                    return sum + (winnings[playerName] || 0);
                }, 0);
                
                teamWinnings[team.name] = teamTotal;
            });
            finalWinnings = teamWinnings;
        }

        // --- STEP 4: Finalize Results Structure ---
        const finalResults = {
            grossWinner: calculatedScores.grossWinner || 'N/A',
            netWinner: calculatedScores.netWinner || 'N/A',
            winnings: finalWinnings,
            individualWinnings: activeRound.teamMode === 'teams' ? winnings : null, // Keep individual for reference
            teamWinnings: activeRound.teamMode === 'teams' ? teamWinnings : null,
            skinsWon: skinsWon, // Save skins breakdown
            skinsAmount: skinsBets.length > 0 ? skinsBets[0].amount : 0, // Save skins amount
            junkWinnings: junkWinnings, // Save junk winnings breakdown
        };

        // --- STEP 5: Update Firestore Status and Results ---
        try {
            const roundRef = doc(db, getRoundCollectionPath(userId), activeRoundId);
            console.log("Updating round status to 'Ended'...", { activeRoundId, finalResults });
            await updateDoc(roundRef, {
                status: 'Ended',
                results: finalResults,
                betSelections: betSelections, // Ensure bet selections are saved
                scores: scores, // Ensure final scores are saved
                lastUpdated: serverTimestamp(),
            });
            console.log("Round ended and results saved successfully!");
            setIsRoundEndModalOpen(true);
        } catch (error) {
            console.error("Failed to end round status:", error);
            alert(`Error ending round: ${error.message || error.toString()}\n\nPlease check the console for more details.`);
            handleError("Failed to end round status:", error);
        }
    };


    // 3. Data Manipulation Handlers

    // Player Management
    const handleAddPlayer = async () => {
        const fullName = `${newPlayerFirstName.trim()} ${newPlayerLastName.trim()}`.trim();
        if (!db || !userId || !newPlayerFirstName.trim()) return;
        try {
            const handicapValue = parseInt(newPlayerHandicap, 10) || 0;

            if (selectedExistingPlayerId) {
                // Update existing saved player (e.g., handicap change)
                const playerRef = doc(db, getPlayerCollectionPath(userId), selectedExistingPlayerId);
                await updateDoc(playerRef, {
                    name: fullName,
                    handicap: handicapValue,
                    lastUpdated: serverTimestamp(),
                });

                // Ensure this player is included in the current round roster
                setRoundPlayerIds(prev => prev.includes(selectedExistingPlayerId)
                    ? prev
                    : [...prev, selectedExistingPlayerId]
                );
            } else {
                // Create completely new saved player and include them in the round
                const newDocRef = await addDoc(collection(db, getPlayerCollectionPath(userId)), {
                    name: fullName,
                    handicap: handicapValue,
                    createdAt: serverTimestamp(),
                });

                setRoundPlayerIds(prev => [...prev, newDocRef.id]);
            }

            setNewPlayerFirstName('');
            setNewPlayerLastName('');
            setNewPlayerHandicap('');
            setSelectedExistingPlayerId('');
        } catch (error) {
            handleError("Failed to add player:", error);
        }
    };

    const handleDeletePlayer = async (id) => {
        if (!db || !userId) return;
        try {
            await deleteDoc(doc(db, getPlayerCollectionPath(userId), id));
        } catch (error) {
            handleError("Failed to delete player:", error);
        }
    };
    
    const handleEditPlayer = (playerId) => {
        const player = players.find(p => p.id === playerId);
        if (player) {
            // Parse name into first and last
            const parts = (player.name || '').trim().split(/\s+/);
            if (parts.length >= 2) {
                setEditingPlayerFirstName(parts[0]);
                setEditingPlayerLastName(parts.slice(1).join(' '));
            } else if (parts.length === 1) {
                setEditingPlayerFirstName(parts[0]);
                setEditingPlayerLastName('');
            } else {
                setEditingPlayerFirstName('');
                setEditingPlayerLastName('');
            }
            setEditingPlayerHandicap(
                typeof player.handicap === 'number'
                    ? String(player.handicap)
                    : (player.handicap || '')
            );
            setEditingPlayerId(playerId);
        }
    };
    
    const handleSaveEditedPlayer = async () => {
        if (!db || !userId || !editingPlayerId || !editingPlayerFirstName.trim()) return;
        try {
            const fullName = `${editingPlayerFirstName.trim()} ${editingPlayerLastName.trim()}`.trim();
            const handicapValue = parseInt(editingPlayerHandicap, 10) || 0;
            
            await updateDoc(doc(db, getPlayerCollectionPath(userId), editingPlayerId), {
                name: fullName,
                handicap: handicapValue,
                lastUpdated: serverTimestamp(),
            });
            
            setEditingPlayerId(null);
            setEditingPlayerFirstName('');
            setEditingPlayerLastName('');
            setEditingPlayerHandicap('');
        } catch (error) {
            handleError("Failed to update player:", error);
        }
    };

    const handleSetMePlayer = async (playerId) => {
        if (!db || !userId) return;
        try {
            const userRef = doc(db, getUserDocumentPath(userId));
            
            // If clicking the same player, unset it. Otherwise, set the new one.
            const newMyPlayerId = myPlayerId === playerId ? null : playerId;
            
            await setDoc(userRef, {
                myPlayerId: newMyPlayerId,
                lastUpdated: serverTimestamp(),
            }, { merge: true });
            
            setMyPlayerId(newMyPlayerId);
        } catch (error) {
            handleError("Failed to save 'Me' player selection:", error);
        }
    };

    // Custom Bet Management
    const handleAddBet = async () => {
        setBetError(null);
        // For non-Side Bet types, use the type name; for Side Bet, use the custom name
        const betName = newBetType === 'Side Bet' ? newBetName.trim() : newBetType;
        
        if (!db || !userId || !betName || isNaN(parseFloat(newBetAmount)) || parseFloat(newBetAmount) < 0) {
            setBetError(new Error("Invalid bet name or amount."));
            return;
        }
        try {
            const betData = {
                name: betName,
                type: newBetType,
                amount: parseFloat(newBetAmount),
                createdAt: serverTimestamp(),
            };
            
            // Add carryOver field for Skins bets
            if (newBetType === 'Skins') {
                betData.carryOver = newBetCarryOver;
            }
            
            await addDoc(collection(db, getBetCollectionPath(userId)), betData);
            setNewBetName('');
            setNewBetAmount(5);
            setNewBetType(BET_TYPES[0]);
            setNewBetCarryOver(true); // Reset to default
        } catch (error) {
            handleError("Failed to add custom bet:", error);
            setBetError(error);
        }
    };

    const handleDeleteBet = async (id) => {
        if (!db || !userId) return;
        try {
            await deleteDoc(doc(db, getBetCollectionPath(userId), id));
        } catch (error) {
            handleError("Failed to delete custom bet:", error);
        }
    };

    // Course Management
    const handleAddCourse = async () => {
        if (!db || !userId || !newCourseName.trim()) return;
        
        // Validate hole data before saving
        const invalidIndex = HOLE_NUMBERS.some(h => {
            const index = parseInt(holeDataEdit[`hole${h}`]?.index, 10);
            return isNaN(index) || index < 1 || index > 18;
        });

        if (invalidIndex) {
            console.error("Course Error: Please ensure all 18 holes have a valid HCP Index (1-18) before saving.");
            return;
        }

        try {
            await addDoc(collection(db, getCourseCollectionPath(userId)), {
                name: newCourseName.trim(),
                holeData: holeDataEdit,
                createdAt: serverTimestamp(),
            });
            setNewCourseName('');
        } catch (error) {
            handleError("Failed to save course:", error);
        }
    };

    const handleDeleteCourse = async (id) => {
        if (!db || !userId) return;
        try {
            await deleteDoc(doc(db, getCourseCollectionPath(userId), id));
        } catch (error) {
            handleError("Failed to delete course:", error);
        }
    };

    const handleCourseSelect = (courseId) => {
        setSelectedCourseId(courseId);
        
        if (courseId) {
            const selectedCourse = courses.find(c => c.id === courseId);
            if (selectedCourse && selectedCourse.holeData) {
                // Load the course's hole data
                setHoleDataEdit(selectedCourse.holeData);
            }
        } else {
            // Clear selection - reset to default hole data
            setHoleDataEdit(generateDefaultHoleData());
        }
    };

    const handleEditCourse = (courseId) => {
        const course = courses.find(c => c.id === courseId);
        if (course) {
            setEditingCourseId(courseId);
            setEditingCourseHoleData({
                name: course.name,
                holeData: course.holeData || generateDefaultHoleData()
            });
        }
    };

    const handleSaveEditedCourse = async () => {
        if (!db || !userId || !editingCourseId || !editingCourseHoleData) return;
        
        // Validate hole data before saving
        const invalidIndex = HOLE_NUMBERS.some(h => {
            const index = parseInt(editingCourseHoleData.holeData[`hole${h}`]?.index, 10);
            return isNaN(index) || index < 1 || index > 18;
        });

        if (invalidIndex) {
            console.error("Course Error: Please ensure all 18 holes have a valid HCP Index (1-18) before saving.");
            return;
        }

        if (!editingCourseHoleData.name?.trim()) {
            console.error("Course Error: Course name cannot be empty.");
            return;
        }

        try {
            await updateDoc(doc(db, getCourseCollectionPath(userId), editingCourseId), {
                name: editingCourseHoleData.name.trim(),
                holeData: editingCourseHoleData.holeData,
                lastUpdated: serverTimestamp(),
            });
            setEditingCourseId(null);
            setEditingCourseHoleData(null);
        } catch (error) {
            handleError("Failed to update course:", error);
        }
    };

    // 4. Bet Winner Logic (same as before)
    const handleBetWinnerChange = useCallback((betName, winnerName) => {
        setBetSelections(prevWinners => {
            const newSelections = {
                ...prevWinners,
                [betName]: winnerName,
            };
            
            // Debounce Firestore save to prevent rate limiting
            if (betSelectionSaveTimeoutRef.current) {
                clearTimeout(betSelectionSaveTimeoutRef.current);
            }
            
            betSelectionSaveTimeoutRef.current = setTimeout(() => {
                if (db && userId && activeRoundId) {
                    const roundRef = doc(db, getRoundCollectionPath(userId), activeRoundId);
                    updateDoc(roundRef, {
                        betSelections: newSelections,
                        lastUpdated: serverTimestamp(),
                    }).catch(error => {
                        // Silently ignore throttling errors
                        if (!error.message?.includes('backoff') && !error.code?.includes('resource-exhausted')) {
                            handleError("Failed to save bet selection:", error);
                        }
                    });
                }
            }, 2000); // Wait 2 seconds after last change to reduce Firestore writes
            
            return newSelections;
        });
    }, [db, userId, activeRoundId]);

    // Round Bet Handlers (on-the-fly bets)
    const handleAddRoundBet = async () => {
        if (!db || !userId || !activeRoundId || !newRoundBetName.trim() || !newRoundBetAmount) return;
        if (newRoundBetType === 'twoPlayers' && (!newRoundBetPlayer1 || !newRoundBetPlayer2 || !newRoundBetOdds)) return;

        try {
            const newBet = {
                id: `roundbet_${Date.now()}`,
                name: newRoundBetName.trim(),
                betType: newRoundBetType,
                amount: parseFloat(newRoundBetAmount),
                odds: newRoundBetType === 'twoPlayers' ? parseFloat(newRoundBetOdds) : (parseFloat(newRoundBetOdds) || parseFloat(newRoundBetAmount)), // For two players, odds is required. For everyone, default to amount.
                isRoundBet: true,
                ...(newRoundBetType === 'twoPlayers' && {
                    player1: newRoundBetPlayer1,
                    player2: newRoundBetPlayer2
                })
            };

            const updatedRoundBets = [...roundBets, newBet];
            setRoundBets(updatedRoundBets);

            // Save to Firestore
            const roundRef = doc(db, getRoundCollectionPath(userId), activeRoundId);
            await updateDoc(roundRef, {
                roundBets: updatedRoundBets,
                lastUpdated: serverTimestamp(),
            });

            // Reset form
            setNewRoundBetName('');
            setNewRoundBetAmount('');
            setNewRoundBetOdds('');
            setNewRoundBetPlayer1('');
            setNewRoundBetPlayer2('');
            setNewRoundBetType('everyone');
        } catch (error) {
            handleError("Failed to add round bet:", error);
        }
    };

    const handleDeleteRoundBet = async (betId) => {
        if (!db || !userId || !activeRoundId) return;

        try {
            const updatedRoundBets = roundBets.filter(b => b.id !== betId);
            setRoundBets(updatedRoundBets);

            // Save to Firestore
            const roundRef = doc(db, getRoundCollectionPath(userId), activeRoundId);
            await updateDoc(roundRef, {
                roundBets: updatedRoundBets,
                lastUpdated: serverTimestamp(),
            });
        } catch (error) {
            handleError("Failed to delete round bet:", error);
        }
    };

    // 5. Scoring Logic (same as before)
    const handleScoreChange = (playerName, holeNumber, score) => {
        // Update local state immediately for responsive UI using functional update
        setScores(prevScores => {
            const updatedScores = {
                ...prevScores,
                [playerName]: {
                    ...prevScores[playerName],
                    [`hole${holeNumber}`]: score,
                }
            };
            
            // Store latest scores in ref for the timeout
            latestScoresRef.current = updatedScores;
            
            // Auto-save to Firestore with debouncing (only for master user, not read-only)
            if (!isViewingSharedRound && db && userId && activeRoundId) {
                // Clear any pending save
                if (scoreSaveTimeoutRef.current) {
                    clearTimeout(scoreSaveTimeoutRef.current);
                }
                
                // Debounce the save to prevent too many rapid writes
                scoreSaveTimeoutRef.current = setTimeout(async () => {
                    try {
                        const roundRef = doc(db, getRoundCollectionPath(userId), activeRoundId);
                        // Use the latest scores from ref (most recent value)
                        await updateDoc(roundRef, {
                            scores: latestScoresRef.current,
                            lastUpdated: serverTimestamp(),
                        });
                        console.log("Scores auto-saved successfully!");
                    } catch (error) {
                        console.error("Failed to auto-save scores:", error);
                        // Don't show alert for auto-save failures to avoid interrupting user
                    }
                }, 500); // 500ms debounce
            }
            
            return updatedScores;
        });
    };

    const handleJunkEventChange = useCallback((playerName, holeKey, junkId, isChecked) => {
        // Mark that we have a pending save
        hasPendingJunkSaveRef.current = true;
        
        setJunkEvents(prev => {
            const newEvents = { ...prev };
            if (!newEvents[playerName]) {
                newEvents[playerName] = {};
            }
            if (!newEvents[playerName][holeKey]) {
                newEvents[playerName][holeKey] = {};
            }
            if (isChecked) {
                newEvents[playerName][holeKey][junkId] = true;
            } else {
                delete newEvents[playerName][holeKey][junkId];
                if (Object.keys(newEvents[playerName][holeKey]).length === 0) {
                    delete newEvents[playerName][holeKey];
                }
            }
            
            // Debounce Firestore save to prevent rate limiting
            if (junkEventSaveTimeoutRef.current) {
                clearTimeout(junkEventSaveTimeoutRef.current);
            }
            
            junkEventSaveTimeoutRef.current = setTimeout(() => {
                if (db && userId && activeRoundId) {
                    const roundRef = doc(db, getRoundCollectionPath(userId), activeRoundId);
                    updateDoc(roundRef, {
                        junkEvents: newEvents,
                        lastUpdated: serverTimestamp(),
                    }).then(() => {
                        // Clear the pending flag after successful save
                        hasPendingJunkSaveRef.current = false;
                    }).catch(error => {
                        // Clear the pending flag even on error so we don't get stuck
                        hasPendingJunkSaveRef.current = false;
                        // Silently ignore throttling errors
                        if (!error.message?.includes('backoff') && !error.code?.includes('resource-exhausted')) {
                            handleError("Failed to save junk event:", error);
                        }
                    });
                } else {
                    hasPendingJunkSaveRef.current = false;
                }
            }, 2000); // Wait 2 seconds after last change to reduce Firestore writes
            
            return newEvents;
        });
    }, [db, userId, activeRoundId]);

    const handleRoundPlayerHandicapChange = async (playerName, newHandicap) => {
        if (!db || !userId || !activeRoundId || !activeRound) return;

        const parsed = parseInt(newHandicap, 10);
        if (isNaN(parsed)) return;

        try {
            const currentPlayers = (activeRound.players && activeRound.players.length > 0)
                ? activeRound.players
                : players;

            const updatedPlayers = currentPlayers.map(p =>
                p.name === playerName ? { ...p, handicap: parsed } : p
            );

            const roundRef = doc(db, getRoundCollectionPath(userId), activeRoundId);
            await updateDoc(roundRef, {
                players: updatedPlayers,
                lastUpdated: serverTimestamp(),
            });
        } catch (error) {
            handleError("Failed to update round player handicap:", error);
        }
    };

    const handleRemovePlayerFromRound = async (playerName) => {
        if (!db || !userId || !activeRoundId || !activeRound) return;

        try {
            const currentPlayers = (activeRound.players && activeRound.players.length > 0)
                ? activeRound.players
                : players;

            const updatedPlayers = currentPlayers.filter(p => p.name !== playerName);

            // Remove this player's scores locally and in Firestore payload
            const updatedScores = { ...scores };
            delete updatedScores[playerName];

            // Remove this player's junk events
            const updatedJunkEvents = { ...junkEvents };
            delete updatedJunkEvents[playerName];

            const roundRef = doc(db, getRoundCollectionPath(userId), activeRoundId);
            await updateDoc(roundRef, {
                players: updatedPlayers,
                scores: updatedScores,
                junkEvents: updatedJunkEvents,
                lastUpdated: serverTimestamp(),
            });

            // Update local state immediately for snappy UI
            setScores(updatedScores);
            setJunkEvents(updatedJunkEvents);
        } catch (error) {
            handleError("Failed to remove player from round:", error);
        }
    };

    const handleSaveScores = async () => {
        if (!db || !userId || !activeRoundId) return;

        try {
            const roundRef = doc(db, getRoundCollectionPath(userId), activeRoundId);
            await updateDoc(roundRef, {
                scores: scores,
                lastUpdated: serverTimestamp(),
            });
            console.log("Scores saved successfully!");
            // After successful save, ensure we mark the scores as loaded from the DB
            setLastLoadedScoresRoundId(activeRoundId);
        } catch (error) {
            handleError("Failed to save scores:", error);
        }
    };

    const handleLogout = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            // The onAuthStateChanged listener will automatically update the state
            // and show the login screen
        } catch (error) {
            handleError("Failed to logout:", error);
        }
    };


    // --- Main App Render ---

    // Show splash screen first
    if (showSplash) {
        return (
            <SplashScreen 
                onAuthCheckComplete={(isAuthenticated) => {
                    setShowSplash(false);
                    // Auth state will be handled by the existing onAuthStateChanged listener
                }} 
            />
        );
    }

    // Show login screen if not authenticated
    if (!isAuthReady || !userId) {
        return auth ? (
            <LoginFirebaseUI 
                onLoginSuccess={() => {
                    // Auth state will be updated by onAuthStateChanged
                }} 
            />
        ) : (
            <div className="min-h-screen bg-blue-600 flex items-center justify-center">
                <div className="text-white text-lg">Loading...</div>
            </div>
        );
    }

    return (
        <div 
            className="min-h-screen bg-gray-100 p-2 sm:p-3 font-sans"
            style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))' }}
        >
            <script src="https://cdn.tailwindcss.com"></script>
            <style jsx="true">{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
                body { font-family: 'Inter', sans-serif; }
                .sticky { position: sticky; left: 0; }
                .app-title-shadow {
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
                    letter-spacing: -1px;
                }
                .overflow-x-auto {
                    -webkit-overflow-scrolling: touch;
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .overflow-x-auto::-webkit-scrollbar {
                    display: none;
                }
            `}</style>

            <header className="relative mb-4">
                <div className="flex items-center justify-center">
                    {/* Title */}
                    <h1 className="text-3xl font-extrabold text-gray-900 app-title-shadow">
                        Strokes-N-Chokes
                    </h1>
                </div>
            </header>

            <div className="w-full px-2" style={{ paddingBottom: 'calc(75px + env(safe-area-inset-bottom, 0px))' }}>
                {/* Share Code Error Modal */}
                {isShareCodeErrorModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 relative">
                            <button
                                type="button"
                                onClick={() => setIsShareCodeErrorModalOpen(false)}
                                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl leading-none"
                                aria-label="Close"
                            >
                                &times;
                            </button>
                            <div className="text-center">
                                <div className="mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-bold text-red-600 mb-3">
                                    Incorrect Code
                                </h2>
                                <p className="text-gray-700 mb-6">
                                    The share code you entered was not found. Please check the code and try again.
                                </p>
                                <button
                                    onClick={() => {
                                        setIsShareCodeErrorModalOpen(false);
                                        setShareCodeInput('');
                                    }}
                                    className="w-full px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition"
                                >
                                    Try Again
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Round End Modal */}
                {isRoundEndModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 relative">
                            <button
                                type="button"
                                onClick={() => setIsRoundEndModalOpen(false)}
                                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl leading-none"
                                aria-label="Close"
                            >
                                &times;
                            </button>
                            <h2 className="text-2xl font-bold text-center text-blue-700 mb-3">
                                Round Complete!
                            </h2>
                            <p className="text-center text-gray-700 mb-4">
                                Round ended successfully. Scroll down to view the full results and final scorecard.
                            </p>
                            {calculatedScores && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                                    <p className="text-sm text-gray-700 mb-2 text-center">
                                        <span className="font-semibold text-blue-800">Gross Winner:</span>{' '}
                                        <span className="font-bold text-gray-900">
                                            {calculatedScores.grossWinner || 'N/A'}
                                        </span>
                                    </p>
                                    <p className="text-sm text-gray-700 text-center mb-2">
                                        <span className="font-semibold text-blue-800">Net Winner:</span>{' '}
                                        <span className="font-bold text-gray-900">
                                            {calculatedScores.netWinner || 'N/A'}
                                        </span>
                                    </p>
                                    {/* Two-player settlement highlight in modal */}
                                    {(() => {
                                        const players = calculatedScores.players || [];
                                        const results = (activeRound && activeRound.results) || {};
                                        const winnings = results.winnings || {};

                                        if (players.length === 2) {
                                            const [p1, p2] = players;
                                            const w1 = winnings[p1.name] || 0;
                                            const w2 = winnings[p2.name] || 0;
                                            const maxPlayer = w1 >= w2 ? p1 : p2;
                                            const minPlayer = maxPlayer === p1 ? p2 : p1;
                                            const maxW = Math.max(w1, w2);
                                            const minW = Math.min(w1, w2);
                                            const netAmount = Math.max(0, maxW - minW);

                                            if (netAmount > 0) {
                                                return (
                                                    <p className="text-sm font-semibold text-blue-900 text-center mt-2">
                                                        Congrats {maxPlayer.name}, {minPlayer.name} owes you ${netAmount.toFixed(0)}
                                                    </p>
                                                );
                                            }
                                        }

                                        return null;
                                    })()}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setIsRoundEndModalOpen(false);
                                    // Smoothly scroll to the final summary once the modal closes
                                    setTimeout(() => {
                                        if (finalSummaryRef?.current) {
                                            finalSummaryRef.current.scrollIntoView({
                                                behavior: 'smooth',
                                                block: 'start',
                                            });
                                        }
                                    }, 150);
                                }}
                                className="mt-2 w-full py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700"
                            >
                                View Results
                            </button>
                        </div>
                    </div>
                )}

                {/* Play View - Player Selection, Bets/Junk Setup, Course Selection */}
                {currentView === 'play' && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                            <RoundSelector
                                dbReady={dbReady}
                                playersCount={roundPlayerIds.length > 0 ? roundPlayerIds.length : players.length}
                                rounds={rounds}
                                courses={courses}
                                activeRoundId={activeRoundId}
                                handleStartNewRound={handleStartNewRound}
                                handleSelectRound={handleSelectRound}
                                newRoundCourseName={newRoundCourseName}
                                setNewRoundCourseName={setNewRoundCourseName}
                                selectedCourseId={selectedCourseId}
                                setSelectedCourseId={setSelectedCourseId}
                                handleCourseSelect={handleCourseSelect}
                                handicapMode={handicapMode}
                                setHandicapMode={setHandicapMode}
                            />
                            <PlayerManager
                                dbReady={dbReady}
                                newPlayerFirstName={newPlayerFirstName}
                                setNewPlayerFirstName={setNewPlayerFirstName}
                                newPlayerLastName={newPlayerLastName}
                                setNewPlayerLastName={setNewPlayerLastName}
                                newPlayerHandicap={newPlayerHandicap}
                                setNewPlayerHandicap={setNewPlayerHandicap}
                                handleAddPlayer={handleAddPlayer}
                                players={players}
                                selectedExistingPlayerId={selectedExistingPlayerId}
                                setSelectedExistingPlayerId={setSelectedExistingPlayerId}
                                roundPlayerIds={roundPlayerIds}
                                setRoundPlayerIds={setRoundPlayerIds}
                                myPlayerId={myPlayerId}
                            />
                            <TeamsManager
                                dbReady={dbReady}
                                teamMode={teamMode}
                                setTeamMode={setTeamMode}
                                teams={teams}
                                setTeams={setTeams}
                                players={players}
                                roundPlayerIds={roundPlayerIds}
                            />
                            <CustomBetManager
                            dbReady={dbReady}
                            newBetName={newBetName}
                            setNewBetName={setNewBetName}
                            newBetType={newBetType}
                            setNewBetType={setNewBetType}
                            newBetAmount={newBetAmount}
                            setNewBetAmount={setNewBetAmount}
                            newBetCarryOver={newBetCarryOver}
                            setNewBetCarryOver={setNewBetCarryOver}
                            handleAddBet={handleAddBet}
                            customBets={customBets}
                            handleDeleteBet={handleDeleteBet}
                            betError={betError}
                        />
                        <JunkManager
                            dbReady={dbReady}
                            selectedJunkTypes={selectedJunkTypes}
                            setSelectedJunkTypes={setSelectedJunkTypes}
                            junkPointValues={junkPointValues}
                            setJunkPointValues={setJunkPointValues}
                        />
                    </div>
                    
                    {/* Start New Round Button - At bottom of Play page */}
                    <div className="mt-6 mb-6">
                        {(() => {
                            const playerCount = roundPlayerIds.length > 0 ? roundPlayerIds.length : players.length;
                            return (
                                <>
                                    {playerCount === 0 && (
                                        <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
                                            Please add at least one player to start a new round.
                                        </div>
                                    )}
                                    
                                    {!selectedCourseId && (
                                        <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
                                            Please select a course to start a new round.
                                        </div>
                                    )}
                                    
                                    <button
                                        onClick={handleStartNewRound}
                                        className="w-full px-6 py-4 bg-blue-600 text-white font-bold text-lg rounded-lg hover:bg-blue-700 transition duration-150 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={!dbReady || playerCount === 0 || !selectedCourseId}
                                    >
                                        Start New Round
                                    </button>
                                </>
                            );
                        })()}
                    </div>
                    </>
                )}

                {/* Rounds View - Scorecard, Bets, Summary, Winnings */}
                {currentView === 'rounds' && (
                    <>
                        {(activeRoundId || isViewingSharedRound) ? (
                            <Scorecard
                                activeRound={activeRound}
                                activeRoundId={isViewingSharedRound ? sharedRoundId : activeRoundId}
                                isReadOnly={isViewingSharedRound}
                                isShareModalOpen={isShareModalOpen}
                                setIsShareModalOpen={setIsShareModalOpen}
                                shareCodeInput={shareCodeInput}
                                setShareCodeInput={setShareCodeInput}
                                handleEnterShareCode={handleEnterShareCode}
                                isViewingSharedRound={isViewingSharedRound}
                                setIsViewingSharedRound={setIsViewingSharedRound}
                                setSharedRound={setSharedRound}
                                setSharedRoundId={setSharedRoundId}
                                setActiveRoundId={setActiveRoundId}
                                scores={scores}
                                handleScoreChange={handleScoreChange}
                                handleSaveScores={handleSaveScores}
                                handleEndRound={handleEndRound}
                                dbReady={dbReady}
                                calculatedScores={calculatedScores}
                                allAvailableBets={allAvailableBets}
                                selectedJunkTypes={selectedJunkTypes}
                                junkPointValues={junkPointValues}
                                junkEvents={junkEvents}
                                handleJunkEventChange={handleJunkEventChange}
                                finalSummaryRef={finalSummaryRef}
                                handleRoundPlayerHandicapChange={handleRoundPlayerHandicapChange}
                                handleRemovePlayerFromRound={handleRemovePlayerFromRound}
                                betSelections={betSelections}
                                handleBetWinnerChange={handleBetWinnerChange}
                                userId={userId}
                                players={players}
                                roundBets={roundBets}
                                handleAddRoundBet={handleAddRoundBet}
                                handleDeleteRoundBet={handleDeleteRoundBet}
                                newRoundBetName={newRoundBetName}
                                setNewRoundBetName={setNewRoundBetName}
                                newRoundBetType={newRoundBetType}
                                setNewRoundBetType={setNewRoundBetType}
                                newRoundBetAmount={newRoundBetAmount}
                                setNewRoundBetAmount={setNewRoundBetAmount}
                                newRoundBetOdds={newRoundBetOdds}
                                setNewRoundBetOdds={setNewRoundBetOdds}
                                newRoundBetPlayer1={newRoundBetPlayer1}
                                setNewRoundBetPlayer1={setNewRoundBetPlayer1}
                                newRoundBetPlayer2={newRoundBetPlayer2}
                                setNewRoundBetPlayer2={setNewRoundBetPlayer2}
                                myPlayerId={myPlayerId}
                            />
                        ) : (
                            <div className="p-8 bg-white rounded-2xl shadow-xl border-2 border-gray-200">
                              
                                
                                {/* Share Code Entry */}
                                <div className="max-w-md mx-auto">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Enter Share Code to View Round:
                                    </label>
                                    <input
                                        type="text"
                                        value={shareCodeInput}
                                        onChange={(e) => setShareCodeInput(e.target.value.toUpperCase().slice(0, 4))}
                                        placeholder="Enter Code"
                                        maxLength={4}
                                        className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-xl font-bold tracking-widest uppercase mb-2"
                                    />
                                    <button
                                        onClick={async () => {
                                            await handleEnterShareCode();
                                        }}
                                        disabled={!dbReady || shareCodeInput.length !== 4}
                                        className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        View Round
                                    </button>
                                    {shareCodeInput.length > 0 && shareCodeInput.length < 4 && (
                                        <p className="text-xs text-gray-500 mt-2 text-center">
                                            Enter 4 characters
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                        
                        {/* Rounds List - Always shown at bottom of Rounds page */}
                        <div className="mt-8 p-6 bg-white rounded-2xl shadow-xl border-2 border-gray-200">
                            <h3 className="text-lg font-medium mb-3 text-gray-700 text-center">
                                Current Active or Past Rounds ({rounds.length})
                            </h3>
                            <ul className="space-y-2 max-h-96 overflow-y-auto">
                                {rounds
                                    .slice()
                                    .sort((a, b) => {
                                        // First sort by status: Active rounds before Ended (and others)
                                        const statusOrder = (status) => {
                                            if (status === 'Active') return 0;
                                            if (status === 'Ended') return 1;
                                            return 2;
                                        };

                                        const statusDiff = statusOrder(a.status) - statusOrder(b.status);
                                        if (statusDiff !== 0) return statusDiff;

                                        // Within same status, sort by date/createdAt descending (latest first)
                                        const getDate = (round) => {
                                            if (round.createdAt?.toDate) return round.createdAt.toDate();
                                            if (round.date) return new Date(round.date);
                                            return 0;
                                        };

                                        const dateA = getDate(a);
                                        const dateB = getDate(b);

                                        return dateB - dateA;
                                    })
                                    .map(round => {
                                        const isTeamRound = round.teamMode === 'teams';
                                        const playerCount = isTeamRound && round.teams 
                                            ? round.teams.reduce((total, team) => total + (team.playerIds?.length || 0), 0)
                                            : (round.players?.length || 0);
                                        
                                        return (
                                            <li key={round.id}
                                                onClick={() => handleSelectRound(round.id)}
                                                className={`p-3 rounded-lg cursor-pointer transition duration-150 border ${activeRoundId === round.id ? 'bg-blue-100 border-blue-500 text-blue-800 font-semibold' : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'}`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <span className="font-semibold">{round.courseName || 'Unspecified'}</span>
                                                        <span className="text-sm text-gray-500 ml-2">({round.date}) - {round.status}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {isTeamRound ? 'Team' : 'Single'} • {playerCount} {playerCount === 1 ? 'Player' : 'Players'}
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                            </ul>
                        </div>
                    </>
                )}

                {/* Management View - Courses and Players */}
                {currentView === 'management' && (
                    <div className="flex flex-col gap-6 mb-6 w-full">
                        <CourseManager
                            dbReady={dbReady}
                            courses={courses}
                            newCourseName={newCourseName}
                            setNewCourseName={setNewCourseName}
                            handleAddCourse={handleAddCourse}
                            handleDeleteCourse={handleDeleteCourse}
                            holeDataEdit={holeDataEdit}
                            editingCourseId={editingCourseId}
                            setEditingCourseId={setEditingCourseId}
                            editingCourseHoleData={editingCourseHoleData}
                            setEditingCourseHoleData={setEditingCourseHoleData}
                            handleEditCourse={handleEditCourse}
                            handleSaveEditedCourse={handleSaveEditedCourse}
                            userId={userId}
                            db={db}
                        />
                        <ManagePlayers
                            dbReady={dbReady}
                            players={players}
                            handleDeletePlayer={handleDeletePlayer}
                            editingPlayerId={editingPlayerId}
                            setEditingPlayerId={setEditingPlayerId}
                            editingPlayerFirstName={editingPlayerFirstName}
                            setEditingPlayerFirstName={setEditingPlayerFirstName}
                            editingPlayerLastName={editingPlayerLastName}
                            setEditingPlayerLastName={setEditingPlayerLastName}
                            editingPlayerHandicap={editingPlayerHandicap}
                            setEditingPlayerHandicap={setEditingPlayerHandicap}
                            handleEditPlayer={handleEditPlayer}
                            handleSaveEditedPlayer={handleSaveEditedPlayer}
                            myPlayerId={myPlayerId}
                            handleSetMePlayer={handleSetMePlayer}
                        />
                        <AccountFunding
                            dbReady={dbReady}
                        />
                    </div>
                )}

                {/* Courses View - Search for Golf Courses */}
                {currentView === 'courses' && (
                    <Courses />
                )}
            </div>

            {/* Bottom Navigation Menu */}
            <div 
                className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-300 shadow-lg z-40"
                style={{ 
                    paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
                    minHeight: 'calc(70px + env(safe-area-inset-bottom, 0px))'
                }}
            >
                <div className="max-w-6xl mx-auto px-4 py-3">
                    <div className="flex justify-around items-center">
                        {/* Play View */}
                        <button
                            onClick={() => setCurrentView('play')}
                            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
                                currentView === 'play'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <line x1="4" y1="2" x2="4" y2="22" strokeLinecap="round" />
                                <path d="M4 2 L12 6 L4 10 Z" fill="currentColor" />
                            </svg>
                            <span className="text-xs font-semibold">Play</span>
                        </button>

                        {/* Rounds View */}
                        <button
                            onClick={() => setCurrentView('rounds')}
                            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
                                currentView === 'rounds'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-xs font-semibold">Rounds</span>
                        </button>

                        {/* Management View */}
                        <button
                            onClick={() => setCurrentView('management')}
                            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition ${
                                currentView === 'management'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-xs font-semibold">Manage</span>
                        </button>

                        {/* Logout Button (Temporary) */}
                        <button
                            onClick={handleLogout}
                            className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition text-red-600 hover:bg-red-50"
                            title="Logout"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span className="text-xs font-semibold">Logout</span>
                        </button>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;