document.addEventListener('DOMContentLoaded', function() {
    const calculateBtn = document.getElementById('calculateBtn');
    const postalCodeInput = document.getElementById('postalCode');
    const resultDiv = document.getElementById('result');
    const snowflakesContainer = document.getElementById('snowflakes');
    
    // API configuration
    const API_KEY = '62cf34140623a500dcefabf855d43809';
    let snowflakes = [];
    
    calculateBtn.addEventListener('click', function() {
        const postalCode = postalCodeInput.value.trim();
        
        if (!postalCode) {
            showResult('Please enter a postal code', 'error');
            return;
        }
        
        if (!/^\d{5}(-\d{4})?$/.test(postalCode)) {
            showResult('Please enter a valid 5-digit US postal code', 'error');
            return;
        }
        
        showResult('<div class="flex justify-center"><div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div></div>', 'loading');
        checkSnowDay(postalCode);
    });
    
    async function checkSnowDay(postalCode) {
        try {
            // First get location data from postal code
            const geoResponse = await fetch(
                `https://api.openweathermap.org/geo/1.0/zip?zip=${postalCode},US&appid=${API_KEY}`
            );
            
            if (!geoResponse.ok) {
                throw new Error('Location not found. Please check your postal code.');
            }
            
            const locationData = await geoResponse.json();
            const { lat, lon, name: locationName } = locationData;
            
            // Then get weather forecast
            const weatherResponse = await fetch(
                `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=imperial`
            );
            
            if (!weatherResponse.ok) {
                throw new Error('Weather data not available. Please try again later.');
            }
            
            const weatherData = await weatherResponse.json();
            analyzeWeather(weatherData, locationName);
            
        } catch (error) {
            showResult(`<p class="text-red-600">${error.message}</p>`, 'error');
            console.error(error);
        }
    }
    
    function analyzeWeather(weatherData, locationName) {
        // Analyze next 24 hours of forecast
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const relevantForecasts = weatherData.list.filter(forecast => {
            const forecastTime = new Date(forecast.dt * 1000);
            return forecastTime >= now && forecastTime <= tomorrow;
        });
        
        // Calculate snow probability
        let snowProbability = 0;
        let snowAmount = 0;
        let minTemp = Infinity;
        let maxWind = 0;
        let conditions = [];
        
        relevantForecasts.forEach(forecast => {
            // Check for snow
            if (forecast.snow && forecast.snow['3h']) {
                snowAmount += forecast.snow['3h'];
            }
            
            // Check weather conditions
            forecast.weather.forEach(weather => {
                conditions.push(weather.main);
                if (weather.main === 'Snow') {
                    snowProbability += 30;
                } else if (weather.main === 'Rain' && forecast.main.temp < 32) {
                    snowProbability += 20; // Freezing rain counts
                }
            });
            
            // Track temperatures
            if (forecast.main.temp_min < minTemp) {
                minTemp = forecast.main.temp_min;
            }
            
            // Track wind speed
            if (forecast.wind.speed > maxWind) {
                maxWind = forecast.wind.speed;
            }
        });
        
        // Calculate probability based on multiple factors
        snowProbability = calculateSnowProbability({
            snowAmount,
            minTemp,
            maxWind,
            conditions,
            baseProbability: snowProbability
        });
        
        // Determine likelihood message and effects
        displayResults(locationName, snowProbability, snowAmount, minTemp, maxWind);
    }
    
    function calculateSnowProbability(factors) {
        let probability = factors.baseProbability;
        
        // Adjust based on snow amount (1 inch = +10% up to 50%)
        if (factors.snowAmount > 0) {
            probability += Math.min(50, factors.snowAmount * 10);
        }
        
        // Adjust based on temperature (below freezing)
        if (factors.minTemp < 32) {
            probability += 20;
        } else if (factors.minTemp < 35) {
            probability += 10;
        }
        
        // Adjust based on wind (wind chill factor)
        if (factors.maxWind > 15 && factors.minTemp < 40) {
            probability += 10;
        }
        
        // Cap probability between 0-100%
        return Math.min(100, Math.max(0, probability));
    }
    
    function displayResults(locationName, snowProbability, snowAmount, minTemp, maxWind) {
        // Determine likelihood message
        let likelihood, likelihoodClass, emoji;
        
        if (snowProbability >= 80) {
            likelihood = 'Extremely likely';
            likelihoodClass = 'text-purple-600';
            emoji = '❄️⛄️🚌';
            createSnowfall(100, true); // Blizzard effect
        } else if (snowProbability >= 60) {
            likelihood = 'Very likely';
            likelihoodClass = 'text-blue-600';
            emoji = '❄️⛄️';
            createSnowfall(60, false);
        } else if (snowProbability >= 40) {
            likelihood = 'Likely';
            likelihoodClass = 'text-blue-500';
            emoji = '❄️';
            createSnowfall(30, false);
        } else if (snowProbability >= 20) {
            likelihood = 'Possible';
            likelihoodClass = 'text-blue-400';
            emoji = '🌨️';
            createSnowfall(15, false);
        } else {
            likelihood = 'Unlikely';
            likelihoodClass = 'text-green-600';
            emoji = '☀️';
            clearSnowfall();
        }
        
        // Display results
        showResult(`
            <h3 class="text-2xl font-bold mb-4 text-center">${locationName}</h3>
            
            <div class="mb-6 bg-white/90 p-4 rounded-lg shadow-inner">
                <div class="flex items-center justify-between mb-2">
                    <span class="font-semibold">Snow Day Chance:</span>
                    <span class="${likelihoodClass} font-bold">${likelihood} ${emoji}</span>
                </div>
                
                <div class="w-full bg-gray-200 rounded-full h-4 mb-3">
                    <div class="bg-blue-600 h-4 rounded-full" style="width: ${snowProbability}%"></div>
                </div>
                <p class="text-right text-sm">${Math.round(snowProbability)}% probability</p>
            </div>
            
            <div class="grid grid-cols-2 gap-4 text-sm">
                <div class="bg-white/90 p-3 rounded-lg">
                    <p class="font-semibold">Expected Snow</p>
                    <p>${snowAmount > 0 ? snowAmount.toFixed(1) + ' inches' : 'None'}</p>
                </div>
                <div class="bg-white/90 p-3 rounded-lg">
                    <p class="font-semibold">Low Temperature</p>
                    <p>${Math.round(minTemp)}°F</p>
                </div>
                <div class="bg-white/90 p-3 rounded-lg">
                    <p class="font-semibold">Max Wind</p>
                    <p>${Math.round(maxWind)} mph</p>
                </div>
                <div class="bg-white/90 p-3 rounded-lg">
                    <p class="font-semibold">Recommendation</p>
                    <p>${snowProbability >= 60 ? 'Prepare for snow day!' : 'Likely a school day'}</p>
                </div>
            </div>
            
            <p class="text-xs mt-4 text-center text-gray-600">Data provided by OpenWeatherMap</p>
        `, 'success');
    }
    
    function showResult(message, type) {
        resultDiv.innerHTML = message;
        resultDiv.className = `bg-blue-50/90 rounded-lg p-6 text-blue-900 border border-blue-200 ${type === 'error' ? 'bg-red-100 border-red-300' : ''}`;
        resultDiv.classList.remove('hidden');
    }
    
    // Enhanced Snowfall Effect
    function createSnowflake(blizzard = false) {
        const snowflake = document.createElement('div');
        snowflake.innerHTML = blizzard ? '❄️' : Math.random() > 0.5 ? '❄️' : '❅';
        snowflake.className = 'snowflake absolute pointer-events-none';
        
        // Random properties
        const size = blizzard ? 
            Math.random() * 12 + 8 : 
            Math.random() * 20 + 10;
        
        const startX = Math.random() * window.innerWidth;
        const animationDuration = blizzard ? 
            Math.random() * 3 + 2 : 
            Math.random() * 8 + 5;
        
        const delay = Math.random() * 5;
        const opacity = blizzard ? 
            Math.random() * 0.5 + 0.3 : 
            Math.random() * 0.7 + 0.3;
        
        const zIndex = Math.floor(Math.random() * 5) + 5;
        const swayAmount = Math.random() * 40 - 20;
        
        snowflake.style.left = `${startX}px`;
        snowflake.style.top = '-30px';
        snowflake.style.fontSize = `${size}px`;
        snowflake.style.opacity = opacity;
        snowflake.style.zIndex = zIndex;
        snowflake.style.animation = `fall ${animationDuration}s linear ${delay}s infinite`;
        snowflake.style.transform = `translateX(${swayAmount}px)`;
        
        return snowflake;
    }
    
    function createSnowfall(count, blizzard = false) {
        // Clear existing snow
        clearSnowfall();
        
        // Create new snowflakes
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const flake = createSnowflake(blizzard);
                snowflakesContainer.appendChild(flake);
                snowflakes.push(flake);
                
                // Make some flakes rotate
                if (Math.random() > 0.7) {
                    flake.style.animation += `, spin ${Math.random() * 5 + 3}s linear infinite`;
                }
            }, Math.random() * 2000);
        }
        
        // For blizzard effect, add wind sound (commented out as it requires user interaction)
        // if (blizzard) {
        //     const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-cold-blizzard-1231.mp3');
        //     audio.volume = 0.3;
        //     audio.loop = true;
        //     audio.play();
        // }
    }
    
    function clearSnowfall() {
        snowflakesContainer.innerHTML = '';
        snowflakes = [];
    }
    
    // Handle window resize
    window.addEventListener('resize', function() {
        snowflakes.forEach(flake => {
            flake.style.left = `${Math.random() * window.innerWidth}px`;
        });
    });
});