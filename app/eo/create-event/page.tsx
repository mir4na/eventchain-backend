"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react"
import { blockchainService } from "@/lib/blockchain"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface RevenueBeneficiary {
  address: string
  percentage: number
}

export default function CreateEventPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    eventName: "",
    description: "",
    location: "",
    eventDate: "",
    eventTime: "",
    eventImageFile: null as File | null,
    documentFile: null as File | null,
  })

  const [beneficiaries, setBeneficiaries] = useState<RevenueBeneficiary[]>([
    { address: "", percentage: 100 }
  ])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData({
        ...formData,
        [fieldName]: file
      })
    }
  }

  const addBeneficiary = () => {
    setBeneficiaries([...beneficiaries, { address: "", percentage: 0 }])
  }

  const removeBeneficiary = (index: number) => {
    if (beneficiaries.length === 1) {
      alert("You must have at least one beneficiary")
      return
    }
    setBeneficiaries(beneficiaries.filter((_, i) => i !== index))
  }

  const updateBeneficiary = (index: number, field: 'address' | 'percentage', value: string | number) => {
    const updated = [...beneficiaries]
    updated[index] = {
      ...updated[index],
      [field]: value
    }
    setBeneficiaries(updated)
  }

  const validateForm = () => {
    if (!formData.eventName || !formData.eventDate || !formData.eventTime) {
      alert("Please fill in all required fields")
      return false
    }

    // Validate beneficiaries
    for (const ben of beneficiaries) {
      if (!ben.address || ben.percentage <= 0) {
        alert("All beneficiaries must have a valid address and percentage")
        return false
      }
    }

    // Check total percentage = 100
    const totalPercentage = beneficiaries.reduce((sum, b) => sum + Number(b.percentage), 0)
    if (totalPercentage !== 100) {
      alert(`Total revenue share must equal 100%. Current total: ${totalPercentage}%`)
      return false
    }

    return true
  }

  const uploadToIPFS = async (file: File): Promise<string> => {
    // TODO: Implement actual IPFS upload using Pinata
    // For now, return placeholder
    console.log("Uploading file to IPFS:", file.name)
    
    // Mock implementation - in production, use Pinata API
    const formData = new FormData()
    formData.append('file', file)
    
    // This should be replaced with actual Pinata upload
    // const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT}`
    //   },
    //   body: formData
    // })
    
    return `ipfs://QmExample${Date.now()}` // Placeholder
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    try {
      setLoading(true)

      // Upload files to IPFS
      let eventURI = ""
      let documentURI = ""

      if (formData.eventImageFile) {
        eventURI = await uploadToIPFS(formData.eventImageFile)
      }
      if (formData.documentFile) {
        documentURI = await uploadToIPFS(formData.documentFile)
      }

      // Combine date and time to Unix timestamp
      const eventDateTime = new Date(`${formData.eventDate}T${formData.eventTime}`)
      const eventTimestamp = Math.floor(eventDateTime.getTime() / 1000)

      // Convert percentages to basis points (10000 = 100%)
      const addresses = beneficiaries.map(b => b.address)
      const percentages = beneficiaries.map(b => Math.floor(b.percentage * 100))

      // Create event on blockchain
      const contract = await blockchainService.getContract()
      const tx = await contract.createEvent(
        formData.eventName,
        eventURI,
        documentURI,
        eventTimestamp,
        addresses,
        percentages
      )

      const receipt = await tx.wait()
      
      // Extract eventId from event logs
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = contract.interface.parseLog(log)
          return parsed?.name === 'EventCreated'
        } catch {
          return false
        }
      })

      if (event) {
        const parsed = contract.interface.parseLog(event)
        const eventId = parsed?.args?.eventId

        alert(`Event created successfully! Event ID: ${eventId}\n\nWaiting for admin approval...`)
        router.push('/eo/dashboard')
      } else {
        alert("Event created successfully! Waiting for admin approval...")
        router.push('/eo/dashboard')
      }

    } catch (error: any) {
      console.error("Error creating event:", error)
      alert("Failed to create event: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const totalPercentage = beneficiaries.reduce((sum, b) => sum + Number(b.percentage || 0), 0)

  return (
    <div className="min-h-screen bg-background pt-32 pb-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link href="/eo/dashboard">
          <Button variant="ghost" className="mb-6 text-gray-400 hover:text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-heading text-white mb-2">Create New Event</h1>
          <p className="text-gray-400 font-body">
            Submit your event for admin approval
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card className="border-white/10 bg-gradient-to-br from-gray-900/80 to-gray-950/80">
            <CardHeader>
              <CardTitle className="text-xl font-subheading text-white">
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="eventName" className="text-white font-subheading mb-2 block">
                  Event Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="eventName"
                  name="eventName"
                  value={formData.eventName}
                  onChange={handleInputChange}
                  placeholder="e.g., Neon Waves Festival 2025"
                  required
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>

              <div>
                <Label htmlFor="description" className="text-white font-subheading mb-2 block">
                  Description
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe your event..."
                  rows={4}
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>

              <div>
                <Label htmlFor="location" className="text-white font-subheading mb-2 block">
                  Location
                </Label>
                <Input
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="e.g., Jakarta Convention Center"
                  className="bg-white/5 border-white/20 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="eventDate" className="text-white font-subheading mb-2 block">
                    Event Date <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="eventDate"
                    name="eventDate"
                    type="date"
                    value={formData.eventDate}
                    onChange={handleInputChange}
                    required
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="eventTime" className="text-white font-subheading mb-2 block">
                    Event Time <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="eventTime"
                    name="eventTime"
                    type="time"
                    value={formData.eventTime}
                    onChange={handleInputChange}
                    required
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Files Upload */}
          <Card className="border-white/10 bg-gradient-to-br from-gray-900/80 to-gray-950/80">
            <CardHeader>
              <CardTitle className="text-xl font-subheading text-white">
                Media & Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="eventImage" className="text-white font-subheading mb-2 block">
                  Event Image/Poster
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="eventImage"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'eventImageFile')}
                    className="bg-white/5 border-white/20 text-white file:bg-white/10 file:text-white"
                  />
                  {formData.eventImageFile && (
                    <span className="text-green-400 text-sm">
                      {formData.eventImageFile.name}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="document" className="text-white font-subheading mb-2 block">
                  Supporting Documents (Optional)
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="document"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => handleFileChange(e, 'documentFile')}
                    className="bg-white/5 border-white/20 text-white file:bg-white/10 file:text-white"
                  />
                  {formData.documentFile && (
                    <span className="text-green-400 text-sm">
                      {formData.documentFile.name}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revenue Sharing */}
          <Card className="border-white/10 bg-gradient-to-br from-gray-900/80 to-gray-950/80">
            <CardHeader>
              <CardTitle className="text-xl font-subheading text-white flex items-center justify-between">
                <span>Revenue Sharing</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addBeneficiary}
                  className="text-xs"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Beneficiary
                </Button>
              </CardTitle>
              <p className="text-sm text-gray-400">
                Total must equal 100%. Current: {totalPercentage}%
                {totalPercentage !== 100 && (
                  <span className="text-red-400 ml-2">⚠️ Invalid</span>
                )}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {beneficiaries.map((beneficiary, index) => (
                <div key={index} className="flex items-end gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex-1">
                    <Label className="text-white font-subheading mb-2 block text-sm">
                      Wallet Address
                    </Label>
                    <Input
                      value={beneficiary.address}
                      onChange={(e) => updateBeneficiary(index, 'address', e.target.value)}
                      placeholder="0x..."
                      required
                      className="bg-white/5 border-white/20 text-white font-mono text-sm"
                    />
                  </div>

                  <div className="w-32">
                    <Label className="text-white font-subheading mb-2 block text-sm">
                      Percentage
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={beneficiary.percentage}
                      onChange={(e) => updateBeneficiary(index, 'percentage', parseFloat(e.target.value) || 0)}
                      required
                      className="bg-white/5 border-white/20 text-white"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => removeBeneficiary(index)}
                    disabled={beneficiaries.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex gap-4">
            <Link href="/eo/dashboard" className="flex-1">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
              >
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={loading || totalPercentage !== 100}
              className="flex-1 bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 hover:from-blue-400 hover:to-blue-600 text-white font-subheading font-semibold"
            >
              {loading ? "Creating..." : "Create Event & Submit for Approval"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
