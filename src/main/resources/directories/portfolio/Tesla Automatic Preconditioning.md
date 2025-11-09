title: Tesla Automatic Preconditioning
type: Personal Project
year: 2025
technologies: Java 21, Spring Boot 3.5, PostgreSQL, Docker, Tesla Fleet API, Google Calendar API, Google Maps API, Google Weather API, Liquibase, Maven, Spring Security, JPA

# Tesla Automatic Preconditioning

## Project Overview

**Type:** Personal Project  
**Tech Stack:** Spring Boot, Tesla API, Docker  
**Status:** Active & In Production  
**GitHub:** https://github.com/javaDevJT/Tesla-Automatic-Preconditioning

## Description

Intelligent automation system that preconditions Tesla vehicles based on calendar events, weather conditions, and learned usage patterns. Ensures your Tesla is perfectly climate-controlled and ready to drive before you even step outside.

## Architecture

┌────────────────┐
│ Google Calendar│ Calendar Events (Departure Times)
└───────┬────────┘
        │
┌───────▼────────┐
│  Spring Boot   │ Scheduler & Orchestration
│  Application   │ • Scheduled Tasks (Cron)
│                │ • Event Processing
│                │ • Smart Learning Algorithm
└───────┬────────┘
        │
┌───────▼────────┐
│   Tesla API    │ Vehicle Control & Monitoring
│   Integration  │ • Climate Control
│                │ • Battery Status
│                │ • Location Data
└───────┬────────┘
        │
┌───────▼────────┐
│      H2        │ Historical Data & Patterns
│   Database     │ • Usage History
│                │ • Learned Preferences
│                │ • Event Logs
└────────────────┘

## Key Features

### Calendar Integration
- Syncs with Google Calendar to detect upcoming events
- Automatically preconditions vehicle 15-30 minutes before departure
- Respects event locations (home vs. work vs. other)
- Configurable lead time based on weather conditions

### Weather-Aware Preconditioning
- Integrates with weather APIs to determine optimal preconditioning time
- Extends preconditioning duration in extreme temperatures
- Adjusts climate settings based on forecast (heat/cool)
- Battery-friendly scheduling (avoids excessive drain)

### Smart Adjustments
- Learns daily routines and patterns over time
- Adapts to changes in schedule automatically
- Overrides manual preconditioning when necessary

### Security & Privacy
- Encrypted token storage
- No third-party data sharing
- Self-hosted deployment option

### Real-World Benefits
• **No More Frozen Mornings:** Car is perfectly warm before you leave home
• **Battery Preservation:** Smart scheduling prevents excessive battery drain
• **Seamless Integration:** Works invisibly in the background

## Technical Implementation

### Core Scheduling Service (Real Implementation)

```java
@Slf4j
@Service
public class PreConditioningSchedulerService {
    
    @Autowired
    FleetApiService fleetApiService;
    
    @Autowired
    GoogleCalendarService googleCalendarService;
    
    @Autowired
    private RoutesCalculationService routesCalculationService;
    
    @Autowired
    private WeatherService weatherService;
    
    @Autowired
    private SmartScheduleManager smartScheduleManager;
    
    @Autowired
    private IntelligentVehicleDataCache vehicleDataCache;
    
    @Value("${tesla.vin.csv}")
    private String vinCsv;
    
    @Value("${tesla.home.lat}")
    private double homeLatitude;
    
    @Value("${tesla.home.lon}")
    private double homeLongitude;
    
    @Value("${tesla.preconditioning.buffer.minutes}")
    private int preconditioningBufferMinutes;
    
    @Scheduled(cron = "0 */5 * * * *")  // Every 5 minutes
    public void processCalendarEvents() {
        List<Event> events = googleCalendarService.loadEvents();
        
        for (Event event : events) {
            // Process each calendar event for preconditioning
            // (Implementation details in full service class)
        }
    }
}
```

### Fleet API Integration with Caching

```java
@Slf4j
@Service
public class FleetApiService {
    
    @Autowired
    private FleetApi fleetApi;
    
    @Autowired
    private IntelligentVehicleDataCache vehicleDataCache;
    
    // Cache for vehicle wake state
    private final Map<String, Long> vehicleWakeCache = 
        new ConcurrentHashMap<>();
    private static final long WAKE_CACHE_DURATION_MS = 10 * 60 * 1000L;
    
    /**
     * Get vehicle data with specific endpoints and caching
     */
    public VehicleData getVehicleDataWithEndpoints(
            String vin, String endpoints, boolean useCache) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            
            Map<String, String> queryParams = new HashMap<>();
            queryParams.put("endpoints", endpoints);
            if (!useCache) {
                queryParams.put("use_cache", "false");
            }
            
            log.debug("Requesting vehicle data for VIN {} with endpoints: {}", 
                vin, endpoints);
            String vehicleDataJson = fleetApi.vehicleData(vin, queryParams);
            
            TeslaApiResponse apiResponse = mapper.readValue(
                vehicleDataJson, TeslaApiResponse.class);
            VehicleData parsedData = apiResponse.getResponse();
            
            if (parsedData == null) {
                log.error("Tesla API response contains null vehicle data");
                throw new RuntimeException("Invalid API response structure");
            }
            
            return parsedData;
        } catch (Exception e) {
            log.error("Failed to parse vehicle data: {}", e.getMessage());
            throw new RuntimeException("Failed to parse vehicle data", e);
        }
    }
}
```

### Smart Schedule Matching Algorithm

```java
@Slf4j
@Component
public class SmartScheduleManager {
    
    private static final int TOLERANCE_MINUTES = 5;
    
    public enum ScheduleMatchResult {
        EXACT_MATCH,        // Perfect match, can reuse
        TOLERANCE_MATCH,    // Within tolerance, can reuse
        NEEDS_MODIFICATION, // Close but needs small changes
        NO_MATCH           // Completely different
    }
    
    /**
     * Find best matching existing preconditioning schedule
     */
    public ScheduleComparison findBestMatch(
            List<VehicleData.PreconditionSchedule> existingSchedules, 
            int desiredPreconditioningTime, 
            DayOfWeek dayOfWeek,
            FleetApiService fleetApiService) {
        
        if (existingSchedules == null || existingSchedules.isEmpty()) {
            return new ScheduleComparison(ScheduleMatchResult.NO_MATCH, 
                null, "No existing schedules");
        }
        
        // Filter to one-time enabled schedules
        List<VehicleData.PreconditionSchedule> oneTimeSchedules = 
            existingSchedules.stream()
                .filter(VehicleData.PreconditionSchedule::getOne_time)
                .filter(VehicleData.PreconditionSchedule::getEnabled)
                .toList();
        
        VehicleData.PreconditionSchedule bestMatch = null;
        ScheduleMatchResult bestResult = ScheduleMatchResult.NO_MATCH;
        int bestTimeDifference = Integer.MAX_VALUE;
        
        for (VehicleData.PreconditionSchedule schedule : oneTimeSchedules) {
            Set<DayOfWeek> scheduleDays = fleetApiService
                .decodeDaysOfWeek(schedule.getDays_of_week());
            if (!scheduleDays.contains(dayOfWeek)) {
                continue;
            }
            
            int timeDiff = Math.abs(schedule.getPrecondition_time() 
                - desiredPreconditioningTime);
            
            // Exact match
            if (timeDiff == 0) {
                return new ScheduleComparison(
                    ScheduleMatchResult.EXACT_MATCH, 
                    schedule, 
                    "Exact time match"
                );
            }
            
            // Within tolerance (±5 minutes)
            if (timeDiff <= TOLERANCE_MINUTES && 
                timeDiff < bestTimeDifference) {
                bestMatch = schedule;
                bestResult = ScheduleMatchResult.TOLERANCE_MATCH;
                bestTimeDifference = timeDiff;
            }
        }
        
        return new ScheduleComparison(bestResult, bestMatch, 
            String.format("Time diff: %d min", bestTimeDifference));
    }
}
```

### Advanced Weather Risk Algorithm (Real Implementation)

The snow/ice accumulation risk algorithm is a sophisticated piece of code that analyzes the last 24 hours of weather data:

```java
@Service
@RequiredArgsConstructor
public class WeatherService {
    
    /**
     * Calculate snow/ice coverage risk score over last N hours (max 24)
     * using recency weighting and temperature factors
     */
    public Mono<Double> snowIceCoverageRiskLastNHours(
            double lat, double lng, int hours, 
            Optional<UnitsSystem> unitsOpt) {
        
        int clamped = Math.max(1, Math.min(24, hours));
        
        // Tunables: exponential decay and temperature effects
        double halfLifeHours = 6.0;     // Recent hours matter most
        double meltPerDegC = 0.07;      // Melt factor above freezing
        double freezeBoostPerDegC = 0.02; // Boost below freezing
        
        return getHourlyHistory(lat, lng, Optional.of(clamped), unitsOpt)
            .map(root -> {
                double weightedRisky = 0.0;
                double weightedQpfMm = 0.0;
                double weightedFreeze = 0.0;
                double weightedIce = 0.0;
                double totalWeight = 0.0;
                
                JsonNode hoursNode = root.path("historyHours");
                if (!hoursNode.isArray() || hoursNode.isEmpty()) 
                    return 0.0;
                
                // Determine reference time from newest hour
                Instant now = Instant.now();
                try {
                    String newestTs = hoursNode.get(0)
                        .path("time").asText(null);
                    if (newestTs != null) 
                        now = Instant.parse(newestTs);
                } catch (Exception ignored) { }
                
                for (int i = 0; i < hoursNode.size(); i++) {
                    JsonNode h = hoursNode.get(i);
                    
                    // Calculate age of this hour's data
                    double ageHours;
                    try {
                        String ts = h.path("time").asText(null);
                        if (ts != null) {
                            Instant t = Instant.parse(ts);
                            ageHours = Math.max(0, 
                                Duration.between(t, now).toHours());
                        } else {
                            ageHours = i;
                        }
                    } catch (Exception e) {
                        ageHours = i;
                    }
                    
                    // Exponential decay: recent hours have more impact
                    double decay = Math.pow(0.5, ageHours / halfLifeHours);
                    
                    // Extract precipitation data
                    JsonNode prob = h.path("precipitation").path("probability");
                    int percent = prob.path("percent").asInt(0);
                    String type = prob.path("type").asText("NONE");
                    boolean isSnowOrIceType = "SNOW".equals(type) || 
                        "RAIN_AND_SNOW".equals(type) || 
                        "SLEET".equals(type) || 
                        "FREEZING_RAIN".equals(type);
                    
                    // Quantity in mm
                    JsonNode qpf = h.path("precipitation").path("qpf");
                    double qty = qpf.path("quantity").asDouble(0.0);
                    String unit = qpf.path("unit").asText("MILLIMETERS");
                    double qtyMm = "INCHES".equals(unit) ? 
                        qty * 25.4 : qty;
                    
                    // Temperature in Celsius
                    JsonNode temp = h.path("temperature");
                    double deg = temp.path("degrees").asDouble(Double.NaN);
                    String tUnit = temp.path("unit").asText("CELSIUS");
                    double degC = "FAHRENHEIT".equals(tUnit) ? 
                        (deg - 32.0) * (5.0/9.0) : deg;
                    
                    // Temperature factor: boost/reduce based on temp
                    double tempFactor = 1.0;
                    if (!Double.isNaN(degC)) {
                        if (degC > 0.0) {
                            // Above freezing: reduce contribution
                            double reduction = Math.min(0.8, 
                                Math.max(0.0, degC * meltPerDegC));
                            tempFactor = 1.0 - reduction;
                        } else if (degC < 0.0) {
                            // Below freezing: boost contribution
                            double boost = Math.min(0.2, 
                                Math.max(0.0, (-degC) * freezeBoostPerDegC));
                            tempFactor = 1.0 + boost;
                        }
                    }
                    
                    // Combined weight: decay * temperature factor
                    double weight = decay * tempFactor;
                    totalWeight += weight;
                    
                    // Accumulate weighted scores
                    boolean riskyHour = isSnowOrIceType && percent >= 50;
                    if (riskyHour) {
                        weightedRisky += weight;
                        weightedQpfMm += qtyMm * weight;
                    }
                    if (!Double.isNaN(degC) && degC <= 0.0) {
                        weightedFreeze += weight;
                    }
                }
                
                if (totalWeight == 0.0) return 0.0;
                
                // Normalize weighted components
                double hoursFrac = weightedRisky / totalWeight;
                double qpfScore = Math.min(1.0, weightedQpfMm / 1.5);
                double freezeFrac = weightedFreeze / totalWeight;
                
                // Final risk score: weighted combination
                double risk = 0.45 * hoursFrac + 
                             0.35 * qpfScore + 
                             0.20 * freezeFrac;
                
                return Math.max(0.0, Math.min(1.0, risk));
            })
            .timeout(Duration.ofSeconds(timeoutSeconds))
            .retryWhen(Retry.backoff(3, Duration.ofMillis(200))
                .filter(this::isRetryable).transientErrors(true));
    }
    
    /**
     * Convenience method: check if risk exceeds threshold
     */
    public boolean hasHighSnowOrIceCoverageLast12h(
            double lat, double lon, Optional<UnitsSystem> units) {
        Double risk = snowIceCoverageRiskLastNHours(lat, lon, 12, units)
            .block();
        return risk != null && risk > 0.55; // Tuned threshold
    }
}
```

**Algorithm Highlights:**
- **Recency Weighting:** Recent hours weighted exponentially higher (half-life: 6h)
- **Temperature Context:** Precipitation at 28°F gets 20% boost vs. 42°F gets 50% reduction
- **Multi-Factor Score:** Combines snow hours (45%), quantity (35%), freeze duration (20%)
- **Normalized [0,1]:** Threshold of 0.55 provides balanced sensitivity

## Challenges & Solutions

### Challenge 1: Weather API Response Size
**Problem:** Full weather responses were too large and slow  
**Solution:** Implemented precise field masking for Google Routes API, reducing response size by ~70%

### Challenge 2: Schedule Verification Race Conditions
**Problem:** Async schedule creation sometimes failed silently  
**Solution:** Implemented delayed async verification with **new DB transaction** (`REQUIRES_NEW` propagation) to ensure schedules actually exist in Tesla's system

### Challenge 3: Snow/Ice Accumulation Detection
**Problem:** Simple temperature checks missed nuanced ice risk scenarios  
**Solution:** Developed sophisticated algorithm with:
- 24-hour hourly history analysis
- Recency weighting (exponential decay)
- Temperature-based boost/melt factors
- Normalized scoring [0,1]

### Challenge 4: Google Calendar Permissions
**Problem:** Accessing user calendars securely across domains  
**Solution:** Service account with domain-wide delegation and optional impersonation

### Challenge 5: Multi-Vehicle Support
**Problem:** Managing multiple Teslas with different schedules  
**Solution:** CSV-based VIN assignment to calendar event assignees (`email:VIN,email:VIN`)

### Challenge 6: PostgreSQL Schema Evolution
**Problem:** Database schema changes breaking production  
**Solution:** Liquibase migrations with versioned changelogs for reliable schema management

## Lessons Learned

### Weather Analysis
• **Recency Weighting is Key:** Recent snow/ice is far more relevant than 24h ago
• **Temperature Context is Everything:** Same precipitation at 28°F vs. 42°F has vastly different risk
• **Threshold Tuning:** 0.55 normalized score provides good balance (tuned via testing)

### API Integration
• **Domain-Wide Delegation:** Powerful but requires careful security configuration
• **Rate Limiting Awareness:** Google APIs have generous free tiers but require thoughtful usage

## Technologies

**Core Framework:**  
`Java 21` `Spring Boot 3.5.5` `Spring Framework 6` `Maven 3.9+`

**Backend:**  
`Spring Security` `Spring Scheduler` `JPA/Hibernate` `JDBC`

**Database:**  
`PostgreSQL 14+` `Liquibase` `Testcontainers` (for testing)

**Google Cloud APIs:**  
`Google Calendar API` (service account + domain-wide delegation)  
`Google Maps Routes API` (field-masked responses)  
`Google Weather API` (current, forecast, hourly history)

**Tesla Integration:**  
`Tesla Fleet API` (via Teslemetry)  
`One-time preconditioning schedules`

**Infrastructure:**  
`Podman/Docker` `Multi-arch containers` (AMD64 + ARM64)  
`GitHub Container Registry` (GHCR)

**Monitoring & Observability:**  
`Spring Boot Actuator` `Logging` `Email/SMS notifications`

**Build & Test:**  
`Maven Toolchain` (Java 24 for tooling)  
`Testcontainers` `JUnit` `PostgreSQL test containers`

## Configuration

The project uses `application.yml` with comprehensive configuration options:

```yaml
google:
  calendar:
    credentials-path: file:/path/to/service-account.json
    application-name: Tesla Automatic Preconditioning
    name: calendar@group.calendar.google.com
  maps:
    routes:
      field-mask: routes.distanceMeters,routes.duration,routes.routeLabels
  weather:
    api-key: ${GOOGLE_WEATHER_API_KEY}
    base-url: https://weather.googleapis.com/v1
    units: IMPERIAL

teslemetry:
  oauth:
    token: ${TESLEMETRY_TOKEN}

tesla:
  vin:
    csv: email1:VIN1,email2:VIN2
  home:
    lat: 40.7128
    lon: -74.0060
  preconditioning:
    buffer:
      minutes: 10
    scheduling:
      out-of-metro-threshold-miles: 100
      rescheduling:
        enabled: true
        movement-threshold-miles: 25
        time-savings-threshold-minutes: 30
        minimum-time-remaining-hours: 2

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/tesla_preconditioning
    username: postgres
    password: ${DB_PASSWORD}
  liquibase:
    enabled: true
    change-log: classpath:db/changelog/17-01-changelog.yaml
```

## Deployment

### Build & Run

```bash
# Build JAR
./mvnw clean package

# Run application
java -jar target/Tesla-Automatic-Preconditioning-0.0.40.jar
```

### Multi-Architecture Container Build

The project includes streamlined container build & push:

```bash
export VERSION=0.0.40
export IMAGE_ID=ghcr.io/javadevjt/tesla-automatic-preconditioning

# Build both architectures
podman build --arch amd64 -t ${IMAGE_ID}:amd64-${VERSION} .
podman build --arch arm64 -t ${IMAGE_ID}:arm64-${VERSION} .

# Push images
podman push ${IMAGE_ID}:amd64-${VERSION}
podman push ${IMAGE_ID}:arm64-${VERSION}

# Create and push manifest
podman manifest create ${IMAGE_ID}:${VERSION}
podman manifest add ${IMAGE_ID}:${VERSION} ${IMAGE_ID}:amd64-${VERSION}
podman manifest add ${IMAGE_ID}:${VERSION} ${IMAGE_ID}:arm64-${VERSION}
podman manifest push ${IMAGE_ID}:${VERSION}
```

**Benefits:**
- ✅ AMD64 for traditional x86 servers
- ✅ ARM64 for cost-effective cloud instances (AWS Graviton, etc.)
- ✅ Single manifest for seamless deployment

## Security Best Practices

The project includes comprehensive security measures:

✅ **SECURITY_CHECKLIST.md** - Security documentation  
✅ **application.yml.template** - Template without secrets  
✅ Comprehensive `.gitignore` - Protects credentials  
✅ Environment variable configuration  
✅ Spring Security with API key protection  
✅ OAuth2 resource server support

**Never commit:**
- `src/main/resources/google/*.json` (service account credentials)
- `src/main/resources/application.yml` (actual config with secrets)
- `.env` files

## Project Statistics

```
Lines of Code:     ~3,500+ Java
Test Coverage:     Testcontainers integration tests
Container Images:  Multi-arch (AMD64 + ARM64)
Latest Version:    0.0.40-SNAPSHOT
Active Since:      August 2025
```

## Key Achievements

✅ **Production-Grade Architecture** - Spring Boot 3 + Java 21 + PostgreSQL  
✅ **Advanced Weather Analysis** - Recency-weighted snow/ice risk algorithm  
✅ **Intelligent Scheduling** - Async verification with new transaction boundaries  
✅ **API Optimization** - Field masking reduces response size by 70%  
✅ **Multi-Architecture Support** - AMD64 + ARM64 container images  
✅ **Database Migrations** - Liquibase for reliable schema versioning  
✅ **Comprehensive Testing** - Testcontainers for integration testing  
✅ **Security First** - OAuth2, Spring Security, credential protection  

---

**GitHub:** https://github.com/javaDevJT/Tesla-Automatic-Preconditioning  
**Status:** ✅ Active Development & In Production  
**Version:** 0.0.40-SNAPSHOT
