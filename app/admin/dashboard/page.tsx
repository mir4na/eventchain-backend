"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Clock, TrendingUp, Users, Ticket } from "lucide-react"
import { apiClient } from "@/lib/api"
import { blockchainService } from "@/lib/blockchain"
import { useRouter } from "next/navigation"

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [pendingEvents, setPendingEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkAdminAccess()
  }, [])

  const checkAdminAccess = async () => {
    try {
      const address = await blockchainService.getCurrentAccount()
      if (!address) {
        router.push("/login")
        return
      }

      const contract = await blockchainService.getContract()
      const adminStatus = await contract.isAdmin(address)
      
      if (!adminStatus) {
        alert("Access denied: You are not an admin")
        router.push("/events")
        return
      }

      setIsAdmin(true)
      await loadDashboardData()
    } catch (error) {
      console.error("Error checking admin access:", error)
      router.push("/events")
    }
  }

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const events = await apiClient.getEvents({ status: 'PENDING' })
      setPendingEvents(events)

      // Calculate stats
      const allEvents = await apiClient.getEvents({})
      setStats({
        totalEvents: allEvents.length,
        pendingEvents: events.length,
        approvedEvents: allEvents.filter(e => e.status === 'APPROVED').length,
        rejectedEvents: allEvents.filter(e => e.status === 'REJECTED').length,
      })
    } catch (error) {
      console.error("Error loading dashboard:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveEvent = async (eventId: number) => {
    try {
      const contract = await blockchainService.getContract()
      const tx = await contract.approveEvent(eventId)
      await tx.wait()
      
      alert("Event approved successfully!")
      await loadDashboardData()
    } catch (error: any) {
      console.error("Error approving event:", error)
      alert("Failed to approve event: " + error.message)
    }
  }

  const handleRejectEvent = async (eventId: number) => {
    try {
      const contract = await blockchainService.getContract()
      const tx = await contract.rejectEvent(eventId)
      await tx.wait()
      
      alert("Event rejected successfully!")
      await loadDashboardData()
    } catch (error: any) {
      console.error("Error rejecting event:", error)
      alert("Failed to reject event: " + error.message)
    }
  }

  if (!isAdmin || loading) {
    return (
      <div className="min-h-screen bg-background pt-32 pb-12">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center">
            <p className="text-white text-xl">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pt-32 pb-12">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-heading text-white mb-2">Admin Dashboard</h1>
          <p className="text-gray-400 font-body">Manage event approvals and platform statistics</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-white/10 bg-gradient-to-br from-gray-900/80 to-gray-950/80">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 font-body text-sm mb-1">Total Events</p>
                  <p className="text-3xl font-heading text-white">{stats?.totalEvents || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-gradient-to-br from-gray-900/80 to-gray-950/80">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 font-body text-sm mb-1">Pending Approval</p>
                  <p className="text-3xl font-heading text-white">{stats?.pendingEvents || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-gradient-to-br from-gray-900/80 to-gray-950/80">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 font-body text-sm mb-1">Approved</p>
                  <p className="text-3xl font-heading text-white">{stats?.approvedEvents || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-gradient-to-br from-gray-900/80 to-gray-950/80">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 font-body text-sm mb-1">Rejected</p>
                  <p className="text-3xl font-heading text-white">{stats?.rejectedEvents || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Events */}
        <Card className="border-white/10 bg-gradient-to-br from-gray-900/80 to-gray-950/80">
          <CardHeader>
            <CardTitle className="text-2xl font-heading text-white">
              Pending Event Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingEvents.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 font-body">No pending events</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingEvents.map((event) => (
                  <div
                    key={event.eventId}
                    className="p-6 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-subheading font-semibold text-white">
                            {event.eventName}
                          </h3>
                          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                            Pending
                          </Badge>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <p className="text-gray-400 font-body">
                            <span className="text-gray-500">Event ID:</span> #{event.eventId}
                          </p>
                          <p className="text-gray-400 font-body">
                            <span className="text-gray-500">Creator:</span>{" "}
                            <span className="font-mono">{event.eventCreator}</span>
                          </p>
                          <p className="text-gray-400 font-body">
                            <span className="text-gray-500">Date:</span>{" "}
                            {new Date(event.eventDate).toLocaleDateString()}
                          </p>
                          <p className="text-gray-400 font-body">
                            <span className="text-gray-500">Location:</span> {event.location || "TBA"}
                          </p>
                          {event.description && (
                            <p className="text-gray-400 font-body mt-3">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          onClick={() => handleApproveEvent(event.eventId)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleRejectEvent(event.eventId)}
                          variant="destructive"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
