import React, { useState } from 'react';

const API_KEY = 'd75f6880-c25f-45f4-91b0-424de3b14c3e';
// Use proxy in development (browser), direct URL in production (mobile app)
const isDevelopment = import.meta.env.DEV;
const API_BASE_URL = isDevelopment 
    ? '/api/golf/courses'  // Proxy through Vite dev server
    : 'https://www.golfapi.io/api/v2.3/courses';  // Direct URL for mobile apps

const Courses = () => {
    const [courseId, setCourseId] = useState('');
    const [courseData, setCourseData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const searchCourse = async () => {
        if (!courseId.trim()) {
            setError('Please enter a course ID');
            return;
        }

        setLoading(true);
        setError(null);
        setCourseData(null);

        try {
            // In development, proxy handles Authorization header
            // In production, add Authorization header directly
            const fetchOptions = {
                method: 'GET',
                redirect: 'follow',
                headers: {
                    'Accept': 'application/json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            };
            
            // Add Authorization header in production (mobile apps)
            if (!isDevelopment) {
                fetchOptions.headers['Authorization'] = `Bearer ${API_KEY}`;
                fetchOptions.headers['Referer'] = 'https://www.golfapi.io/';
                fetchOptions.headers['Origin'] = 'https://www.golfapi.io';
            }

            const response = await fetch(`${API_BASE_URL}/${courseId}`, fetchOptions);
           // const response = await fetch(`https://www.golfapi.io/api/v2.3/courses/${courseId}`, fetchOptions);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Course not found. Please check the course ID.');
                } else if (response.status === 401) {
                    throw new Error('Authentication failed. Please check the API key.');
                } else {
                    throw new Error(`Failed to fetch course: ${response.status} ${response.statusText}`);
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

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            searchCourse();
        }
    };

    return (
        <div className="flex flex-col gap-6 mb-6 w-full">
            <div className="p-6 bg-white rounded-2xl shadow-xl border-2 border-gray-200">
                <h2 className="text-2xl font-bold mb-4 text-gray-800">Search for Courses</h2>
                
                {/* Search Input */}
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Course ID:
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={courseId}
                            onChange={(e) => setCourseId(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Enter course ID (e.g., 012141520658891108829)"
                            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                            onClick={searchCourse}
                            disabled={loading || !courseId.trim()}
                            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {loading ? 'Searching...' : 'Search'}
                        </button>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                        {error}
                    </div>
                )}

                {/* Course Data Display */}
                {courseData && (
                    <div className="mt-6 space-y-6">
                        <div className="border-t-2 border-gray-200 pt-6">
                            <h3 className="text-xl font-bold mb-4 text-gray-800">Course Information</h3>
                            
                            {/* Basic Course Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                {courseData.name && (
                                    <div>
                                        <span className="text-sm font-semibold text-gray-600">Name:</span>
                                        <p className="text-lg text-gray-800">{courseData.name}</p>
                                    </div>
                                )}
                                {courseData.city && (
                                    <div>
                                        <span className="text-sm font-semibold text-gray-600">City:</span>
                                        <p className="text-lg text-gray-800">{courseData.city}</p>
                                    </div>
                                )}
                                {courseData.state && (
                                    <div>
                                        <span className="text-sm font-semibold text-gray-600">State:</span>
                                        <p className="text-lg text-gray-800">{courseData.state}</p>
                                    </div>
                                )}
                                {courseData.country && (
                                    <div>
                                        <span className="text-sm font-semibold text-gray-600">Country:</span>
                                        <p className="text-lg text-gray-800">{courseData.country}</p>
                                    </div>
                                )}
                                {courseData.phone && (
                                    <div>
                                        <span className="text-sm font-semibold text-gray-600">Phone:</span>
                                        <p className="text-lg text-gray-800">{courseData.phone}</p>
                                    </div>
                                )}
                                {courseData.website && (
                                    <div>
                                        <span className="text-sm font-semibold text-gray-600">Website:</span>
                                        <a 
                                            href={courseData.website} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-lg text-blue-600 hover:underline"
                                        >
                                            {courseData.website}
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Address */}
                            {(courseData.address || courseData.zip) && (
                                <div className="mb-6">
                                    <span className="text-sm font-semibold text-gray-600">Address:</span>
                                    <p className="text-lg text-gray-800">
                                        {courseData.address}
                                        {courseData.address && courseData.zip && ', '}
                                        {courseData.zip}
                                    </p>
                                </div>
                            )}

                            {/* Tees Information */}
                            {courseData.tees && courseData.tees.length > 0 && (
                                <div className="mt-6">
                                    <h4 className="text-lg font-bold mb-4 text-gray-800">Tees</h4>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full bg-white border border-gray-300 rounded-lg">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Tee Name</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Gender</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Yardage</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Par</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Rating</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-b">Slope</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {courseData.tees.map((tee, index) => (
                                                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                        <td className="px-4 py-3 text-sm text-gray-800 border-b">{tee.name || 'N/A'}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-800 border-b">{tee.gender || 'N/A'}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-800 border-b">{tee.yardage || 'N/A'}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-800 border-b">{tee.par || 'N/A'}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-800 border-b">{tee.rating || 'N/A'}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-800 border-b">{tee.slope || 'N/A'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Holes Information */}
                            {courseData.holes && courseData.holes.length > 0 && (
                                <div className="mt-6">
                                    <h4 className="text-lg font-bold mb-4 text-gray-800">Holes</h4>
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
                            <details className="mt-6">
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
        </div>
    );
};

export default Courses;

