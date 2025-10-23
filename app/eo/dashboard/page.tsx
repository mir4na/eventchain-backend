"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, Calendar, DollarSign, Ticket, Edit } from "lucide-react"
import { apiClient } from "@/lib/api"
import { blockchainService } from "@/lib/blockchain"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

export default function EODashboardPage() {
  const [myEvents, setMyEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    init()
  }, [])

  const init = async () => {
    try {
      const address = await blockchainService.getCurrentAccount()
      if (!address) {
        router.push("/login")
        return
      }

      setWalletAddress(address)
      await loadMyEvents(address)
    } catch (error) {
      console.error("Error initializing:", error)
    }
  }

  const loadMyEvents = async (address: string) => {
    try {
      setLoading(true)
      const contract = await blockchainService.getContract()
      const eventIds = await contract.getEOEvents(address)
      
      const eventsData = await Promise.all(
        eventIds.map(async (id: bigint) => {
          try {
            const event = await apiClient.getEventById(Number(id))
            return event
          } catch (error) {
            console.error(`Error fetching event ${id}:`, error)
            return null
          }
        })
      )

      setMyEvents(eventsData.filter(e => e !== null))
    } catch (error) {
      console.error("Error loading events:", error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'APPROVED':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'REJECTED':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  if (!walletAddress || loading) {
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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-heading text-white mb-2">Event Organizer Dashboard</h1>
            <p className="text-gray-400 font-body">Manage your events and ticket sales</p>
          </div>
          <Link href="/eo/create-event">
            <Button className="bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 hover:from-blue-400 hover:to-blue-600 text-white font-subheading font-semibold">
              <Plus className="h-5 w-5 mr-2" />
              Create New Event
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-white/10 bg-gradient-to-br from-gray-900/80 to-gray-950/80">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 font-body text-sm mb-1">Total Events</p>
                  <p className="text-3xl font-heading text-white">{myEvents.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-gradient-to-br from-gray-900/80 to-gray-950/80">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 font-body text-sm mb-1">Active Events</p>
                  <p className="text-3xl font-heading text-white">
                    {myEvents.filter(e => e.eventActive).length}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Ticket className="h-6 w-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-gradient-to-br from-gray-900/80 to-gray-950/80">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 font-body text-sm mb-1">Pending Approval</p>
                  <p className="text-3xl font-heading text-white">
                    {myEvents.filter(e => e.status === 'PENDING').length}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Events List */}
        <Card className="border-white/10 bg-gradient-to-br from-gray-900/80 to-gray-950/80">
          <CardHeader>
            <CardTitle className="text-2xl font-heading text-white">My Events</CardTitle>
          </CardHeader>
          <CardContent>
            {myEvents.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 font-body mb-4">No events created yet</p>
                <Link href="/eo/create-event">
                  <Button className="bg-gradient-to-b from-gray-400 via-gray-600 to-gray-700">
                    Create Your First Event
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myEvents.map((event) => (
                  <Card
                    key={event.eventId}
                    className="group overflow-hidden border-white/10 bg-gradient-to-br from-gray-800/50 to-gray-900/50 hover:border-white/20 transition-all cursor-pointer"
                  >
                    <div className="relative h-48 w-full overflow-hidden">
                      <Image
                        src={event.eventURI || "/placeholder.svg"}
                        alt={event.eventName}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute top-3 right-3">
                        <Badge className={getStatusColor(event.status)}>
                          {event.status}
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="p-5 space-y-3">
                      <h3 className="font-subheading font-semibold text-lg text-white leading-tight line-clamp-2">
                        {event.eventName}
                      </h3>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 font-body">Event ID</span>
                          <span className="text-white font-mono">#{event.eventId}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 font-body">Date</span>
                          <span className="text-white font-subheading">
                            {formatDate(event.eventDate)}
                          </span>
                        </div>
                        {event.ticketTypes && event.ticketTypes.length > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 font-body">Tickets Sold</span>
                            <span className="text-white font-subheading">
                              {event.ticketTypes.reduce((sum: number, t: any) => sum + t.sold, 0)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-3 border-t border-white/10">
                        <Link href={`/events/${event.eventId}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full text-xs">
                            View
                          </Button>
                        </Link>
                        {event.status === 'APPROVED' && (
                          <Link href={`/eo/events/${event.eventId}/manage`} className="flex-1">
                            <Button size="sm" className="w-full text-xs bg-gradient-to-b from-gray-400 via-gray-600 to-gray-700">
                              <Edit className="h-3 w-3 mr-1" />
                              Manage
                            </Button>
                          </Link>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
