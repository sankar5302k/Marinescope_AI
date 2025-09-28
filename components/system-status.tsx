"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, AlertTriangle, Wifi, Database, Server, Zap } from "lucide-react"

interface SystemStatusProps {
  lastUpdate: Date
  isLive: boolean
}

export function SystemStatus({ lastUpdate, isLive }: SystemStatusProps) {
  const systemMetrics = [
    {
      name: "Data Ingestion",
      status: "operational",
      uptime: 99.8,
      icon: Database,
      description: "Processing 1.2k points/min",
    },
    {
      name: "Network Connection",
      status: "operational",
      uptime: 99.9,
      icon: Wifi,
      description: "All sensors connected",
    },
    {
      name: "Processing Pipeline",
      status: "operational",
      uptime: 98.5,
      icon: Server,
      description: "12ms avg latency",
    },
    {
      name: "Power Systems",
      status: "warning",
      uptime: 97.2,
      icon: Zap,
      description: "Backup power active",
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          System Status Overview
          <Badge variant={isLive ? "default" : "secondary"} className="gap-1">
            {isLive ? <CheckCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {isLive ? "All Systems Operational" : "Monitoring Paused"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Last updated: {lastUpdate.toLocaleString()} • {systemMetrics.filter((m) => m.status === "operational").length}
          /4 systems operational
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {systemMetrics.map((metric) => {
            const Icon = metric.icon
            return (
              <div key={metric.name} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{metric.name}</span>
                  {metric.status === "operational" ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Uptime</span>
                    <span>{metric.uptime}%</span>
                  </div>
                  <Progress value={metric.uptime} className="h-2" />
                </div>
                <p className="text-xs text-muted-foreground">{metric.description}</p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
