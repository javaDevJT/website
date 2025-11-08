package com.jtdev.website.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.OperatingSystemMXBean;
import java.lang.management.RuntimeMXBean;
import java.net.InetAddress;
import java.util.HashMap;
import java.util.Map;

/**
 * Provides real server runtime information for the terminal interface.
 * Shows actual server specs (CPU, memory, OS, uptime) rather than client browser info.
 */
@RestController
@RequestMapping("/api/server")
public class ServerInfoController {

    private final RuntimeMXBean runtimeMXBean = ManagementFactory.getRuntimeMXBean();
    private final OperatingSystemMXBean osMXBean = ManagementFactory.getOperatingSystemMXBean();
    private final MemoryMXBean memoryMXBean = ManagementFactory.getMemoryMXBean();

    /**
     * Get comprehensive server runtime information.
     * This is what makes the terminal feel like a real SSH session!
     */
    @GetMapping("/info")
    public Mono<Map<String, Object>> getServerInfo() {
        Map<String, Object> info = new HashMap<>();
        
        // Basic server identity
        info.put("hostname", getHostname());
        info.put("serverTime", System.currentTimeMillis());
        
        // Operating System Information
        info.put("os", getOSInfo());
        
        // CPU Information
        info.put("cpu", getCPUInfo());
        
        // Memory Information
        info.put("memory", getMemoryInfo());
        
        // JVM Runtime Information
        info.put("runtime", getRuntimeInfo());
        
        // Uptime
        info.put("uptime", runtimeMXBean.getUptime());
        
        return Mono.just(info);
    }

    /**
     * Get detailed operating system information
     */
    private Map<String, Object> getOSInfo() {
        Map<String, Object> os = new HashMap<>();
        os.put("name", System.getProperty("os.name"));
        os.put("version", System.getProperty("os.version"));
        os.put("arch", System.getProperty("os.arch"));
        
        // Try to get more detailed OS info using OperatingSystemMXBean
        if (osMXBean instanceof com.sun.management.OperatingSystemMXBean sunOsMXBean) {
            os.put("availableProcessors", sunOsMXBean.getAvailableProcessors());
            os.put("systemLoadAverage", sunOsMXBean.getSystemLoadAverage());
            os.put("totalPhysicalMemory", sunOsMXBean.getTotalMemorySize());
            os.put("freePhysicalMemory", sunOsMXBean.getFreeMemorySize());
            os.put("totalSwapSpace", sunOsMXBean.getTotalSwapSpaceSize());
            os.put("freeSwapSpace", sunOsMXBean.getFreeSwapSpaceSize());
        } else {
            os.put("availableProcessors", osMXBean.getAvailableProcessors());
            os.put("systemLoadAverage", osMXBean.getSystemLoadAverage());
        }
        
        return os;
    }

    /**
     * Get CPU information
     */
    private Map<String, Object> getCPUInfo() {
        Map<String, Object> cpu = new HashMap<>();
        cpu.put("cores", Runtime.getRuntime().availableProcessors());
        cpu.put("loadAverage", osMXBean.getSystemLoadAverage());
        
        // Try to get CPU usage if available
        if (osMXBean instanceof com.sun.management.OperatingSystemMXBean sunOsMXBean) {
            cpu.put("processCpuLoad", sunOsMXBean.getProcessCpuLoad() * 100);
            cpu.put("systemCpuLoad", sunOsMXBean.getCpuLoad() * 100);
        }
        
        return cpu;
    }

    /**
     * Get memory information in bytes
     */
    private Map<String, Object> getMemoryInfo() {
        Map<String, Object> memory = new HashMap<>();
        
        // JVM Heap Memory
        long heapMax = memoryMXBean.getHeapMemoryUsage().getMax();
        long heapUsed = memoryMXBean.getHeapMemoryUsage().getUsed();
        long heapCommitted = memoryMXBean.getHeapMemoryUsage().getCommitted();
        
        memory.put("heapMax", heapMax);
        memory.put("heapUsed", heapUsed);
        memory.put("heapCommitted", heapCommitted);
        memory.put("heapFree", heapMax - heapUsed);
        
        // Non-Heap Memory
        memory.put("nonHeapUsed", memoryMXBean.getNonHeapMemoryUsage().getUsed());
        
        // System Memory (if available)
        if (osMXBean instanceof com.sun.management.OperatingSystemMXBean sunOsMXBean) {
            long totalPhysical = sunOsMXBean.getTotalMemorySize();
            long freePhysical = sunOsMXBean.getFreeMemorySize();
            
            memory.put("totalPhysical", totalPhysical);
            memory.put("freePhysical", freePhysical);
            memory.put("usedPhysical", totalPhysical - freePhysical);
        }
        
        return memory;
    }

    /**
     * Get JVM runtime information
     */
    private Map<String, Object> getRuntimeInfo() {
        Map<String, Object> runtime = new HashMap<>();
        
        runtime.put("vmName", runtimeMXBean.getVmName());
        runtime.put("vmVendor", runtimeMXBean.getVmVendor());
        runtime.put("vmVersion", runtimeMXBean.getVmVersion());
        runtime.put("startTime", runtimeMXBean.getStartTime());
        runtime.put("uptime", runtimeMXBean.getUptime());
        
        // Java version info
        runtime.put("javaVersion", System.getProperty("java.version"));
        runtime.put("javaVendor", System.getProperty("java.vendor"));
        runtime.put("javaHome", System.getProperty("java.home"));
        
        return runtime;
    }

    /**
     * Get server hostname
     */
    private String getHostname() {
        try {
            return InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            return "unknown";
        }
    }

    /**
     * Get quick system stats for boot sequence
     */
    @GetMapping("/boot-info")
    public Mono<Map<String, Object>> getBootInfo() {
        Map<String, Object> bootInfo = new HashMap<>();
        
        // Quick stats for boot sequence
        bootInfo.put("hostname", getHostname());
        bootInfo.put("osName", System.getProperty("os.name"));
        bootInfo.put("osVersion", System.getProperty("os.version"));
        bootInfo.put("osArch", System.getProperty("os.arch"));
        bootInfo.put("cpuCores", Runtime.getRuntime().availableProcessors());
        bootInfo.put("javaVersion", System.getProperty("java.version"));
        bootInfo.put("uptime", runtimeMXBean.getUptime());
        
        // Memory in MB for readability
        long totalMemoryMB = 0;
        long freeMemoryMB = 0;
        
        if (osMXBean instanceof com.sun.management.OperatingSystemMXBean sunOsMXBean) {
            totalMemoryMB = sunOsMXBean.getTotalMemorySize() / (1024 * 1024);
            freeMemoryMB = sunOsMXBean.getFreeMemorySize() / (1024 * 1024);
        } else {
            // Fallback to JVM heap
            totalMemoryMB = memoryMXBean.getHeapMemoryUsage().getMax() / (1024 * 1024);
            freeMemoryMB = (memoryMXBean.getHeapMemoryUsage().getMax() - memoryMXBean.getHeapMemoryUsage().getUsed()) / (1024 * 1024);
        }
        
        bootInfo.put("totalMemoryMB", totalMemoryMB);
        bootInfo.put("freeMemoryMB", freeMemoryMB);
        bootInfo.put("usedMemoryMB", totalMemoryMB - freeMemoryMB);
        
        return Mono.just(bootInfo);
    }
}
