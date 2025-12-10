import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

const getCourseCollectionPath = (userId) => `users/${userId}/courses`;

// Use proxy in development (browser) to avoid CORS, direct URL in production (mobile app)
const isDevelopment = import.meta.env.DEV;
const API_BASE_URL = isDevelopment 
    ? '/api/golf/courses'  // Proxy through Vite dev server (matches curl command via proxy)
    : 'https://www.golfapi.io/api/v2.3/courses';  // Direct URL for mobile apps
const COURSES_SEARCH_API_BASE_URL = isDevelopment
    ? '/api/golf/courses'  // Proxy through Vite dev server
    : 'https://www.golfapi.io/api/v2.3/courses';  // Direct URL for mobile apps

const Courses = () => {
    const [courseId, setCourseId] = useState('');
    const [courseData, setCourseData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [userId, setUserId] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importSuccess, setImportSuccess] = useState(false);
    const [latitude, setLatitude] = useState(null);
    const [longitude, setLongitude] = useState(null);
    const [locationError, setLocationError] = useState(null);
    const [cityName, setCityName] = useState('');
    const [citySearchResults, setCitySearchResults] = useState(null);
    const [citySearchLoading, setCitySearchLoading] = useState(false);
    const [citySearchError, setCitySearchError] = useState(null);
    const [importingCourseId, setImportingCourseId] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importedCourseName, setImportedCourseName] = useState('');

    const searchCourse = async () => {
        if (!courseId.trim()) {
            setError('Please enter a course ID');
            return;
        }

        setLoading(true);
        setError(null);
        setCourseData(null);

        try {
            // Use curl-style GET request (matching: curl --location --request GET)
            // In development, proxy handles the request and adds Authorization header
            // The proxy forwards /api/golf/courses/:id to https://www.golfapi.io/api/v2.3/courses/:id
            // In production, make direct request
            // GET requests don't need Content-Type header (no request body)
            const url = `${API_BASE_URL}/${courseId}`;
            console.log('Fetching from:', url);
            const response = await fetch(url, {
                method: 'GET'
            });

            if (!response.ok) {
                // Try to get the full JSON response body
                let errorBody = null;
                try {
                    errorBody = await response.json();
                } catch (e) {
                    // If response is not JSON, try to get text
                    try {
                        errorBody = await response.text();
                    } catch (e2) {
                        errorBody = null;
                    }
                }

                const errorMessage = errorBody 
                    ? `Failed to fetch course: ${response.status} ${response.statusText}\n\nFull Response:\n${JSON.stringify(errorBody, null, 2)}`
                    : `Failed to fetch course: ${response.status} ${response.statusText}`;

                if (response.status === 404) {
                    throw new Error(errorMessage);
                } else if (response.status === 401) {
                    throw new Error(errorMessage);
                } else {
                    throw new Error(errorMessage);
                }
            }

            const data = await response.json();
            setCourseData(data);
        } catch (err) {
            setError(err.message || 'An error occurred while fetching the course data');
        } finally {
            setLoading(false);
        }
    };

    // Get current user
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                setUserId(null);
            }
        });

        return () => unsubscribe();
    }, []);

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

    const handleImportCourse = async () => {
        if (!courseData || !courseData.clubName) {
            setError('No course data to import');
            return;
        }

        if (!userId) {
            setError('Please wait for authentication to complete');
            return;
        }

        if (!courseData.parsMen || !courseData.indexesMen) {
            setError('Course data is missing par or handicap information');
            return;
        }

        setImporting(true);
        setImportSuccess(false);
        setError(null);

        try {
            const holeData = convertToHoleData(courseData.parsMen, courseData.indexesMen);
            const courseDisplayName = getCourseDisplayName(courseData.clubName, courseData.courseName);
            
            await addDoc(collection(db, getCourseCollectionPath(userId)), {
                name: courseDisplayName,
                holeData: holeData,
                createdAt: serverTimestamp(),
            });

            setImportSuccess(true);
            setImportedCourseName(courseDisplayName);
            setShowImportModal(true);
            setTimeout(() => setImportSuccess(false), 3000);
        } catch (err) {
            setError(`Failed to import course: ${err.message}`);
        } finally {
            setImporting(false);
        }
    };

    const handleImportCourseFromResults = async (courseId, e) => {
        // Prevent the click from triggering the course selection
        if (e) {
            e.stopPropagation();
        }

        if (!courseId) {
            setError('No course ID available');
            return;
        }

        if (!userId) {
            setError('Please wait for authentication to complete');
            return;
        }

        setImportingCourseId(courseId);
        setError(null);

        try {
            // First, fetch the full course details
            const url = `${API_BASE_URL}/${courseId}`;
            const response = await fetch(url, {
                method: 'GET'
            });

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

            // Convert and save
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
            setError(`Failed to import course: ${err.message}`);
        } finally {
            setImportingCourseId(null);
        }
    };

    const searchCoursesByCity = async () => {
        if (!cityName.trim()) {
            setCitySearchError('Please enter a city name');
            return;
        }

        setCitySearchLoading(true);
        setCitySearchError(null);
        setCitySearchResults(null);

        try {
            // Build query parameters
            const params = new URLSearchParams({
                city: cityName.trim(),
                country: 'usa',
                measureUnit: 'mi'
            });
            
            const url = `${COURSES_SEARCH_API_BASE_URL}?${params.toString()}`;
            console.log('Fetching courses from:', url);
            
            const response = await fetch(url, {
                method: 'GET'
            });

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

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            searchCourse();
        }
    };

    const handleCityKeyPress = (e) => {
        if (e.key === 'Enter') {
            searchCoursesByCity();
        }
    };

    const handleSelectCourseFromResults = async (selectedCourseId) => {
        if (!selectedCourseId) {
            setError('No course ID available');
            return;
        }

        setCourseId(selectedCourseId);
        setCourseData(null);
        setError(null);
        setLoading(true);
        
        try {
            const url = `${API_BASE_URL}/${selectedCourseId}`;
            console.log('Fetching course details from:', url);
            const response = await fetch(url, {
                method: 'GET'
            });

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
                    ? `Failed to fetch course: ${response.status} ${response.statusText}\n\nFull Response:\n${JSON.stringify(errorBody, null, 2)}`
                    : `Failed to fetch course: ${response.status} ${response.statusText}`;

                throw new Error(errorMessage);
            }

            const data = await response.json();
            setCourseData(data);
            
            // Scroll to course details section
            setTimeout(() => {
                const courseDetailsElement = document.querySelector('[data-course-details]');
                if (courseDetailsElement) {
                    courseDetailsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        } catch (err) {
            setError(err.message || 'An error occurred while fetching the course data');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 mb-6 w-full">
            <div className="p-6 bg-white rounded-2xl shadow-xl border-2 border-gray-200">
                <h2 className="text-2xl font-bold mb-4 text-gray-800">Search for Courses</h2>
                
                {/* City Search Input */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Search Courses by City (30 mile radius):
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={cityName}
                            onChange={(e) => setCityName(e.target.value)}
                            onKeyPress={handleCityKeyPress}
                            placeholder="Enter city name (e.g., San Diego)"
                            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                        <button
                            onClick={searchCoursesByCity}
                            disabled={citySearchLoading || !cityName.trim()}
                            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {citySearchLoading ? 'Searching...' : 'Search City'}
                        </button>
                    </div>
                    {citySearchError && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                            {citySearchError}
                        </div>
                    )}
                </div>

                {/* City Search Results */}
                {citySearchResults && (
                    <div className="mb-6 p-4 bg-white border border-gray-300 rounded-lg">
                        <h3 className="text-lg font-bold mb-3 text-gray-800">
                            Courses Found ({Array.isArray(citySearchResults) ? citySearchResults.length : citySearchResults.courses?.length || 0})
                        </h3>
                        <div className="max-h-96 overflow-y-auto space-y-2">
                            {Array.isArray(citySearchResults) ? (
                                citySearchResults.map((course, index) => {
                                    // Use courseID field for course ID
                                    const courseId = course.courseID;
                                    return (
                                        <div
                                            key={courseId || index}
                                            onClick={() => courseId && handleSelectCourseFromResults(courseId)}
                                            className={`p-3 rounded-lg border cursor-pointer transition ${
                                                courseId 
                                                    ? 'bg-gray-50 border-gray-300 hover:bg-gray-100 hover:border-green-500' 
                                                    : 'bg-gray-100 border-gray-200 cursor-not-allowed'
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
                                            {courseId && (
                                                <div className="text-xs text-gray-500 mt-2">Click anywhere else to view details</div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : citySearchResults.courses ? (
                                citySearchResults.courses.map((course, index) => {
                                    // Use courseID field for course ID
                                    const courseId = course.courseID;
                                    return (
                                        <div
                                            key={courseId || index}
                                            onClick={() => courseId && handleSelectCourseFromResults(courseId)}
                                            className={`p-3 rounded-lg border cursor-pointer transition ${
                                                courseId 
                                                    ? 'bg-gray-50 border-gray-300 hover:bg-gray-100 hover:border-green-500' 
                                                    : 'bg-gray-100 border-gray-200 cursor-not-allowed'
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
                                            {courseId && (
                                                <div className="text-xs text-gray-500 mt-2">Click anywhere else to view details</div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-gray-500 text-center py-4">No courses found</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                        <div className="whitespace-pre-wrap font-mono text-sm">{error}</div>
                    </div>
                )}

                {/* Course Data Display */}
                {courseData && (
                    <div className="mt-6" data-course-details>
                        <div className="p-6 bg-white rounded-2xl shadow-xl border-2 border-gray-200">
                            <h3 className="text-2xl font-bold mb-6 text-gray-800">Course Information</h3>
                            
                            {/* Basic Course Info */}
                            <div className="space-y-2 mb-4">
                                {courseData.clubName && (
                                    <div className="flex items-center py-2 border-b border-gray-100">
                                        <span className="text-sm font-semibold text-gray-600 w-32">Club Name:</span>
                                        <span className="text-base text-gray-800">{courseData.clubName}</span>
                                    </div>
                                )}
                                {courseData.courseName && (
                                    <div className="flex items-center py-2 border-b border-gray-100">
                                        <span className="text-sm font-semibold text-gray-600 w-32">Course Name:</span>
                                        <span className="text-base text-gray-800">{courseData.courseName}</span>
                                    </div>
                                )}
                                {courseData.city && (
                                    <div className="flex items-center py-2 border-b border-gray-100">
                                        <span className="text-sm font-semibold text-gray-600 w-32">City:</span>
                                        <span className="text-base text-gray-800">{courseData.city}</span>
                                    </div>
                                )}
                                {courseData.state && (
                                    <div className="flex items-center py-2 border-b border-gray-100">
                                        <span className="text-sm font-semibold text-gray-600 w-32">State:</span>
                                        <span className="text-base text-gray-800">{courseData.state}</span>
                                    </div>
                                )}
                                {courseData.country && (
                                    <div className="flex items-center py-2 border-b border-gray-100">
                                        <span className="text-sm font-semibold text-gray-600 w-32">Country:</span>
                                        <span className="text-base text-gray-800">{courseData.country}</span>
                                    </div>
                                )}
                                {(courseData.address || courseData.zip) && (
                                    <div className="flex items-center py-2 border-b border-gray-100">
                                        <span className="text-sm font-semibold text-gray-600 w-32">Address:</span>
                                        <span className="text-base text-gray-800">
                                            {courseData.address}
                                            {courseData.address && courseData.zip && ', '}
                                            {courseData.zip}
                                        </span>
                                    </div>
                                )}
                                {courseData.phone && (
                                    <div className="flex items-center py-2 border-b border-gray-100">
                                        <span className="text-sm font-semibold text-gray-600 w-32">Phone:</span>
                                        <span className="text-base text-gray-800">{courseData.phone}</span>
                                    </div>
                                )}
                                {courseData.website && (
                                    <div className="flex items-center py-2 border-b border-gray-100">
                                        <span className="text-sm font-semibold text-gray-600 w-32">Website:</span>
                                        <a 
                                            href={courseData.website} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-base text-blue-600 hover:text-blue-800 hover:underline"
                                        >
                                            {courseData.website}
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Import Button */}
                            {courseData && courseData.clubName && courseData.parsMen && courseData.indexesMen && (
                                <div className="mt-6 mb-6">
                                    <button
                                        onClick={handleImportCourse}
                                        disabled={importing || !userId}
                                        className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-md"
                                    >
                                        {importing ? (
                                            <>
                                                <span className="animate-spin">⏳</span>
                                                <span>Importing...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>💾</span>
                                                <span>Import Course to My Courses</span>
                                            </>
                                        )}
                                    </button>
                                    {importSuccess && (
                                        <div className="mt-2 p-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm text-center">
                                            ✓ Course imported successfully! It will appear in the Play section.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Scorecard - parsMen and indexesMen */}
                            {(courseData.parsMen || courseData.indexesMen) && (
                                <div className="mt-6 pt-6 border-t border-gray-200">
                                    <h4 className="text-xl font-bold mb-4 text-gray-800">Scorecard (Men)</h4>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full bg-white border border-gray-300 rounded-lg">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="px-3 py-2 text-center text-sm font-semibold text-gray-700 border-b border-r">Hole</th>
                                                    {/* Front 9 */}
                                                    {Array.from({ length: 9 }, (_, i) => i + 1).map((holeNum) => (
                                                        <th key={holeNum} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">
                                                            {holeNum}
                                                        </th>
                                                    ))}
                                                    <th className="px-3 py-2 text-center text-sm font-semibold text-gray-700 border-b border-r bg-gray-200">Out</th>
                                                    {/* Back 9 */}
                                                    {Array.from({ length: 9 }, (_, i) => i + 10).map((holeNum) => (
                                                        <th key={holeNum} className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r">
                                                            {holeNum}
                                                        </th>
                                                    ))}
                                                    <th className="px-3 py-2 text-center text-sm font-semibold text-gray-700 border-b">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {/* Par Row */}
                                                {courseData.parsMen && (
                                                    <tr className="bg-white">
                                                        <td className="px-3 py-2 text-sm font-semibold text-gray-800 border-b border-r bg-gray-50">
                                                            Par
                                                        </td>
                                                        {/* Front 9 Pars */}
                                                        {Array.from({ length: 9 }, (_, i) => i + 1).map((holeNum) => {
                                                            const par = courseData.parsMen[holeNum - 1];
                                                            return (
                                                                <td key={holeNum} className="px-2 py-2 text-center text-sm text-gray-800 border-b border-r">
                                                                    {par || '-'}
                                                                </td>
                                                            );
                                                        })}
                                                        {/* Front 9 Total */}
                                                        <td className="px-3 py-2 text-center text-sm font-semibold text-gray-800 border-b border-r bg-gray-200">
                                                            {courseData.parsMen.slice(0, 9).reduce((sum, par) => sum + (par || 0), 0)}
                                                        </td>
                                                        {/* Back 9 Pars */}
                                                        {Array.from({ length: 9 }, (_, i) => i + 10).map((holeNum) => {
                                                            const par = courseData.parsMen[holeNum - 1];
                                                            return (
                                                                <td key={holeNum} className="px-2 py-2 text-center text-sm text-gray-800 border-b border-r">
                                                                    {par || '-'}
                                                                </td>
                                                            );
                                                        })}
                                                        {/* Total Par */}
                                                        <td className="px-3 py-2 text-center text-sm font-semibold text-gray-800 border-b bg-gray-50">
                                                            {courseData.parsMen.reduce((sum, par) => sum + (par || 0), 0)}
                                                        </td>
                                                    </tr>
                                                )}
                                                {/* Handicap Index Row */}
                                                {courseData.indexesMen && (
                                                    <tr className="bg-gray-50">
                                                        <td className="px-3 py-2 text-sm font-semibold text-gray-800 border-b border-r bg-gray-50">
                                                            HCP
                                                        </td>
                                                        {/* Front 9 Handicaps */}
                                                        {Array.from({ length: 9 }, (_, i) => i + 1).map((holeNum) => {
                                                            const hcp = courseData.indexesMen[holeNum - 1];
                                                            return (
                                                                <td key={holeNum} className="px-2 py-2 text-center text-sm text-gray-800 border-b border-r">
                                                                    {hcp || '-'}
                                                                </td>
                                                            );
                                                        })}
                                                        {/* Front 9 Total (dash for handicap) */}
                                                        <td className="px-3 py-2 text-center text-sm text-gray-800 border-b border-r bg-gray-200">
                                                            -
                                                        </td>
                                                        {/* Back 9 Handicaps */}
                                                        {Array.from({ length: 9 }, (_, i) => i + 10).map((holeNum) => {
                                                            const hcp = courseData.indexesMen[holeNum - 1];
                                                            return (
                                                                <td key={holeNum} className="px-2 py-2 text-center text-sm text-gray-800 border-b border-r">
                                                                    {hcp || '-'}
                                                                </td>
                                                            );
                                                        })}
                                                        {/* Total (dash for handicap) */}
                                                        <td className="px-3 py-2 text-center text-sm text-gray-800 border-b bg-gray-50">
                                                            -
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Holes Information */}
                            {courseData.holes && courseData.holes.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-gray-200">
                                    <h4 className="text-xl font-bold mb-4 text-gray-800">Holes</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {courseData.holes.map((hole, index) => (
                                            <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                                <div className="font-semibold text-gray-800 mb-2">Hole {hole.number || index + 1}</div>
                                                <div className="space-y-1 text-sm">
                                                    {hole.par && <div><span className="font-semibold">Par:</span> {hole.par}</div>}
                                                    {hole.yardage && <div><span className="font-semibold">Yardage:</span> {hole.yardage}</div>}
                                                    {hole.handicap && <div><span className="font-semibold">Handicap:</span> {hole.handicap}</div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            
                            {/* Raw JSON (for debugging) */}
                            <details className="mt-6 pt-6 border-t border-gray-200">
                                <summary className="cursor-pointer text-sm font-semibold text-gray-600 hover:text-gray-800">
                                    View Raw JSON Data
                                </summary>
                                <pre className="mt-2 p-4 bg-gray-100 rounded-lg overflow-x-auto text-xs">
                                    {JSON.stringify(courseData, null, 2)}
                                </pre>
                            </details>
                        </div>
                    </div>
                )}
            </div>

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
                        <p className="text-gray-600 text-center mb-6">
                            <span className="font-semibold text-gray-800">{importedCourseName}</span> has been successfully added to your courses.
                        </p>
                        <p className="text-sm text-gray-500 text-center mb-4">
                            You can find it in the "Manage" section under "Existing Courses".
                        </p>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
                            <p className="text-sm text-yellow-800 text-center">
                                <span className="font-semibold">⚠️ Important:</span> Please double-check the handicap indexes in the Manage section to ensure they are correct.
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

export default Courses;

