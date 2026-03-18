"use client"

import React, { use } from 'react'
import {Card, CardHeader, CardDescription, CardContent, CardTitle} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Link } from 'lucide-react'
import { Button } from '@/components/ui/button'


const Signup = () => {
  return (
    <div className="h-full flex items-center justify-center bg-gray-800">
        <Card className="md:h-auto w-[80%] sm:w-[420] p-4 sm:p-8">
            <CardHeader>
                <CardTitle className="text-center">Create account</CardTitle>
                <CardDescription className="text-sm text-center text-accent-foreground">
                    Enter your credentials to access your account
                </CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-6 ">
                <form action="" className="space-y-3">
                <Input type="email" disabled={false} onChange={() => {}} required placeholder="Email" />
                <Input placeholder="Password" disabled={false} onChange={()=>{}} required type="password" />
                <Input placeholder="Confirm Password" disabled={false} onChange={()=>{}} required type="password" />
                <Button className="w-full" disabled={false}>
                    Sign Up
                </Button>
                </form>

                <Separator/>
                
                <p className="text-sm text-center text-muted-foreground mt-2">
                    Already have an account? <a href="/sign-in" className="text-blue-500 hover:underline cursor-pointer">Sign In</a>

                </p>
            </CardContent>
        </Card>
      
    </div>
  )
}

export default Signup
