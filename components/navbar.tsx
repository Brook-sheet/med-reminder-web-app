"use client";

import Link from "next/link";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { GiHamburgerMenu } from "react-icons/gi";
import { MdOutlineSpaceDashboard } from "react-icons/md";
import { CiPill, CiSettings } from "react-icons/ci";
import { GoHistory } from "react-icons/go";
import { CiLogout } from "react-icons/ci";

const Navbar = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/sign-in");
    router.refresh();
  };

  const closeSidebar = () => setOpen(false);

  return (
    <div>
      <button
        type="button"
        className="absolute top-3 right-4 inline-flex items-center justify-center p-2 rounded-md text-gray-800 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white z-30 md:hidden"
        onClick={() => setOpen((current) => !current)}
        aria-label="Toggle navigation menu"
      >
        <GiHamburgerMenu className="h-6 w-6" aria-hidden="true" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-10 bg-black/20 md:hidden"
          onClick={closeSidebar}
        />
      )}

      <div
        className={`p-5 w-1/2 h-screen bg-gray-100 border-r border-gray-400 z-20 fixed top-0 transition-transform ease-out delay-150 duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 md:w-64 md:left-0`}
      >
        <div className="flex flex-col justify-start items-center">
          <h1 className="text-base text-center font-bold text-blue-900 border-b border-gray-300 pb-4 w-full">
            Med App Reminder
          </h1>

          <div className="my-4 border-b border-gray-300 pb-4 w-full">
            <Link
              href="/"
              onClick={closeSidebar}
              className="flex mb-2 justify-start items-center gap-2 px-4 hover:bg-gray-800 p-2 rounded-md group cursor-pointer hover:shadow-lg m-auto"
            >
              <MdOutlineSpaceDashboard className="text-2xl text-gray-800 group-hover:text-white" />
              <h3 className="text-base font-semibold text-gray-800 group-hover:text-white">
                Dashboard
              </h3>
            </Link>
            <Link
              href="/medicines"
              onClick={closeSidebar}
              className="flex mb-2 justify-start items-center gap-2 px-4 hover:bg-gray-800 p-2 rounded-md group cursor-pointer hover:shadow-lg m-auto"
            >
              <CiPill className="text-2xl text-gray-800 group-hover:text-white" />
              <h3 className="text-base font-semibold text-gray-800 group-hover:text-white">
                Medicines
              </h3>
            </Link>
          </div>

          <div className="my-4 border-b border-gray-300 pb-4 w-full">
            <Link
              href="/history"
              onClick={closeSidebar}
              className="flex mb-2 justify-start items-center gap-2 px-4 hover:bg-gray-800 p-2 rounded-md group cursor-pointer hover:shadow-lg m-auto"
            >
              <GoHistory className="text-2xl text-gray-800 group-hover:text-white" />
              <h3 className="text-base font-semibold text-gray-800 group-hover:text-white">
                History
              </h3>
            </Link>
            <Link
              href="/settings"
              onClick={closeSidebar}
              className="flex mb-2 justify-start items-center gap-2 px-4 hover:bg-gray-800 p-2 rounded-md group cursor-pointer hover:shadow-lg m-auto"
            >
              <CiSettings className="text-2xl text-gray-800 group-hover:text-white" />
              <h3 className="text-base font-semibold text-gray-800 group-hover:text-white">
                Settings
              </h3>
            </Link>
          </div>

          <div className="my-4 border-b border-gray-300 pb-4 w-full">
            <button onClick={handleLogout} className="w-full">
              <div className="flex mb-2 justify-start items-center gap-2 px-4 hover:bg-red-600 p-2 rounded-md group cursor-pointer hover:shadow-lg m-auto">
                <CiLogout className="text-2xl text-gray-800 group-hover:text-white" />
                <h3 className="text-base font-semibold text-gray-800 group-hover:text-white">
                  Logout
                </h3>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;