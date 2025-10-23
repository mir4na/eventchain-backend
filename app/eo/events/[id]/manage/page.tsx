"use client"

import { use, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Plus, Edit, Save, Trash2 } from "lucide-react"
import { blockchainService } from "@/lib/blockchain"
import { apiClient } from "@/lib/api"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface TicketTypeForm {
  typeName: string
  price: string
  supply: string
  saleStartDate: string
  saleStartTime: string
  saleEndDate: string
  saleEndTime: string
}

export default function ManageEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [event, setEvent] = useState<any>(null)
  const [ticketTypes, setTicketTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)

  const [newTicketType, setNewTicketType] = useState<TicketTypeForm>({
    typeName: "",
    price: "",
    supply: "",
    saleStartDate: "",
    saleStartTime: "",
    saleEndDate: "",
    saleEndTime: "",
  })

  useEffect(() => {
    loadEventData()
  }, [])

  const loadEventData = async () => {
    try {
      setLoading(true)
      const address = await blockchainService.getCurrentAccount()
      if (!address) {
        router.push("/login")
        return
      }

      const eventData = await apiClient.getEventById(Number(id))
      
      if (eventData.eventCreator.toLowerCase() !== address.toLowerCase()) {
        alert("Access denied: You are not the event creator")
        router.push("/eo/dashboard")
        return
      }

      setEvent(eventData)
      setIsOwner(true)

      if (eventData.ticketTypes) {
        setTicketTypes(eventData.ticketTypes)
      }
    } catch (error) {
      console.error("Error loading event:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTicketType = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (!newTicketType.typeName || !newTicketType.price || !newTicketType.supply) {
        alert("Please fill in all required fields")
        return
      }

      const priceInWei = parseFloat(newTicketType.price)
      if (isNaN(priceInWei) || priceInWei <= 0) {
        alert("Invalid price")
        return
      }

      const supply = parseInt(newTicketType.supply)
      if (isNaN(supply) || supply <= 0) {
        alert("Invalid supply")
        return
      }

      const saleStart = new Date(`${newTicketType.saleStartDate}T${newTicketType.saleStartTime}`)
      const saleEnd = new Date(`${newTicketType.saleEndDate}T${newTicketType.saleEndTime}`)

      if (saleStart >= saleEnd) {
        alert("Sale end time must be after sale start time")
        return
      }

      const saleStartTimestamp = Math.floor(saleStart.getTime() / 1000)
      const saleEndTimestamp = Math.floor(saleEnd.getTime() / 1000)

      const contract = await blockchainService.getContract()
      
      // Convert price from ETH to Wei
      const { ethers } = await import('ethers')
      const priceInWeiString = ethers.parseEther(newTicketType.price).toString()

      const tx = await contract.addTicketType(
        Number(id),
        newTicketType.typeName,
        priceInWeiString,
        supply,
        saleStartTimestamp,
        saleEndTimestamp
      )

      await tx.wait()
      
      alert("Ticket type added successfully!")
      
      // Reset form
      setNewTicketType({
        typeName: "",
        price: "",
        supply: "",
        saleStartDate: "",
        saleStartTime: "",
        saleEndDate: "",
        saleEndTime: "",
      })

      await loadEventData()
    } catch (error: any) {
      console.error("Error adding ticket type:", error)
      alert("Failed to add ticket type: " + error.message)
    }
  }

  const formatPrice = (priceWei: string) => {
    try {
      const { ethers } = require('ethers')
      return ethers.formatEther(priceWei)
    } catch {
      return priceWei
    }
  }

  if (!isOwner || loading) {
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
      <div className="container mx-auto px-4 max-w-6xl">
        <Link href="/eo/dashboard">
          <Button variant="ghost" className="mb-6 text-gray-400 hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-heading text-white mb-2">Manage Event</h1>
          <p className="text-gray-400 font-body">{event?.eventName}</p>
          <div className="mt-2">
            <Badge className={
              event?.status === 'APPROVED' 
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
            }>
              {event?.status}
            </Badge>
          </div>
        </div>

        {/* Existing Ticket Types */}
        {ticketTypes.length > 0 && (
          <Card className="border-white/10 bg-gradient-to-br from-gray-900/80 to-gray-950/80 mb-6">
            <CardHeader>
              <CardTitle className="text-xl font-subheading text-white">
                Existing Ticket Types
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ticketTypes.map((type) => (
                  <div
                    key={type.typeId}
                    className="p-4 rounded-lg bg-white/5 border border-white/10"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-subheading font-semibold text-white mb-2">
                          {type.typeName}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-400 font-body">Price</p>
                            <p className="text-white font-subheading">
                              {formatPrice(type.price)} ETH
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-body">Supply</p>
                            <p className="text-white font-subheading">
                              {type.totalSupply}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-body">Sold</p>
                            <p className="text-white font-subheading">
                              {type.sold}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-body">Status</p>
                            <Badge className={
                              type.active
                                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                            }>
                              {type.active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add New Ticket Type */}
        <Card className="border-white/10 bg-gradient-to-br from-gray-900/80 to-gray-950/80">
          <CardHeader>
            <CardTitle className="text-xl font-subheading text-white">
              Add New Ticket Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTicketType} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="typeName" className="text-white font-subheading mb-2 block">
                    Ticket Type Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="typeName"
                    value={newTicketType.typeName}
                    onChange={(e) => setNewTicketType({ ...newTicketType, typeName: e.target.value })}
                    placeholder="e.g., VIP, Regular"
                    required
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="price" className="text-white font-subheading mb-2 block">
                    Price (ETH) <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.001"
                    min="0"
                    value={newTicketType.price}
                    onChange={(e) => setNewTicketType({ ...newTicketType, price: e.target.value })}
                    placeholder="0.05"
                    required
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="supply" className="text-white font-subheading mb-2 block">
                  Total Supply <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="supply"
                  type="number"
                  min="1"
                  value={newTicketType.supply}
                  onChange={(e) => setNewTicketType({ ...newTicketType, supply: e.target.value })}
                  placeholder="100"
                  required
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white font-subheading mb-2 block">
                    Sale Start <span className="text-red-400">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={newTicketType.saleStartDate}
                      onChange={(e) => setNewTicketType({ ...newTicketType, saleStartDate: e.target.value })}
                      required
                      className="bg-white/5 border-white/20 text-white"
                    />
                    <Input
                      type="time"
                      value={newTicketType.saleStartTime}
                      onChange={(e) => setNewTicketType({ ...newTicketType, saleStartTime: e.target.value })}
                      required
                      className="bg-white/5 border-white/20 text-white"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-white font-subheading mb-2 block">
                    Sale End <span className="text-red-400">*</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={newTicketType.saleEndDate}
                      onChange={(e) => setNewTicketType({ ...newTicketType, saleEndDate: e.target.value })}
                      required
                      className="bg-white/5 border-white/20 text-white"
                    />
                    <Input
                      type="time"
                      value={newTicketType.saleEndTime}
                      onChange={(e) => setNewTicketType({ ...newTicketType, saleEndTime: e.target.value })}
                      required
                      className="bg-white/5 border-white/20 text-white"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 hover:from-blue-400 hover:to-blue-600 text-white font-subheading font-semibold"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Ticket Type
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
