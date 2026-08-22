"use client";

import React, {
  useCallback,
  useEffect,
  useState,
} from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Toast from "@/components/ui/Toast";
import UpdatePasswordModal from "@/components/dashboard/settings/UpdatePasswordModal";
import {
  AlertTriangle,
  Check,
  Copy,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  collectErrors,
  validateAge,
  validateEmail,
  validateName,
  validateOptionalName,
} from "@/lib/validations";

const CONDITIONS = [
  {
    value: "",
    label: "Not specified",
  },
  {
    value: "Diabetes",
    label: "Diabetes",
  },
  {
    value: "Hypertension",
    label: "Hypertension",
  },
  {
    value: "Both",
    label:
      "Both (Diabetes & Hypertension)",
  },
  {
    value: "Other",
    label: "Other",
  },
  {
    value: "None",
    label: "None",
  },
];

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor:
    | "red"
    | "orange";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const ConfirmModal: React.FC<
  ConfirmModalProps
> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmColor,
  onConfirm,
  onCancel,
  loading,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="Close confirmation dialog"
        onClick={onCancel}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      <div className="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>

          <h3 className="text-lg font-bold text-gray-900">
            {title}
          </h3>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-gray-600">
          {message}
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border-2 border-gray-300 py-2.5 font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            No, Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 rounded-xl py-2.5 font-semibold text-white transition-colors disabled:opacity-50 ${
              confirmColor === "red"
                ? "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                : "bg-orange-500 hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700"
            }`}
          >
            {loading
              ? "Processing..."
              : `Yes, ${confirmLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
};

const ProfileCard = () => {
  const router = useRouter();

  const [
    firstName,
    setFirstName,
  ] = useState("");

  const [
    middleName,
    setMiddleName,
  ] = useState("");

  const [
    lastName,
    setLastName,
  ] = useState("");

  const [
    patientId,
    setPatientId,
  ] = useState("");

  const [email, setEmail] =
    useState("");

  const [
    condition,
    setCondition,
  ] = useState("");

  const [age, setAge] =
    useState("");

  const [role, setRole] = useState<
    "patient" | "family"
  >("patient");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    message,
    setMessage,
  ] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [
    previousCondition,
    setPreviousCondition,
  ] = useState("");

  const [
    showDeleteConfirm,
    setShowDeleteConfirm,
  ] = useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [
    showPasswordModal,
    setShowPasswordModal,
  ] = useState(false);

  const [
    patientIdCopied,
    setPatientIdCopied,
  ] = useState(false);

  const copyPatientId =
    async () => {
      if (!patientId) {
        return;
      }

      await navigator.clipboard.writeText(
        patientId
      );

      setPatientIdCopied(true);

      window.setTimeout(
        () =>
          setPatientIdCopied(false),
        2000
      );
    };

  const fetchProfile =
    useCallback(async () => {
      try {
        const response =
          await fetch(
            "/api/profile",
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (!data.success) {
          setMessage({
            type: "error",
            text:
              data.error ||
              "Failed to load profile.",
          });

          return;
        }

        const profileRole =
          data.data.role === "family"
            ? "family"
            : "patient";

        setFirstName(
          data.data.firstName || ""
        );

        setMiddleName(
          data.data.middleName || ""
        );

        setLastName(
          data.data.lastName || ""
        );

        setEmail(
          data.data.email || ""
        );

        setRole(profileRole);

        if (
          profileRole === "patient"
        ) {
          setPatientId(
            data.data.patientId || ""
          );

          setCondition(
            data.data.condition || ""
          );

          setPreviousCondition(
            data.data.condition || ""
          );

          setAge(
            data.data.age == null
              ? ""
              : String(data.data.age)
          );
        } else {
          setPatientId("");
          setCondition("");
          setPreviousCondition("");
          setAge("");
        }
      } catch {
        setMessage({
          type: "error",
          text:
            "Network error. Unable to load profile.",
        });
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    setMessage(null);

    const validationError =
      collectErrors({
        firstName: validateName(
          firstName,
          "First Name"
        ),

        middleName:
          validateOptionalName(
            middleName,
            "Middle Name"
          ),

        lastName: validateName(
          lastName,
          "Last Name"
        ),

        email: validateEmail(email),

        ...(role === "patient"
          ? {
              age: validateAge(age),
            }
          : {}),
      });

    if (validationError) {
      setMessage({
        type: "error",
        text: validationError,
      });

      return;
    }

    setSaving(true);

    try {
      const response =
        await fetch(
          "/api/profile",
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              firstName,
              middleName,
              lastName,
              email,

              ...(role === "patient"
                ? {
                    condition,
                    age:
                      age === ""
                        ? null
                        : Number(
                            age
                          ),
                  }
                : {}),
            }),
          }
        );

      const data =
        await response.json();

      if (!data.success) {
        setMessage({
          type: "error",
          text:
            data.error ||
            "Failed to update profile.",
        });

        return;
      }

      if (
        role === "family" ||
        condition ===
          previousCondition
      ) {
        setMessage({
          type: "success",
          text:
            "Profile updated successfully!",
        });

        return;
      }

      const conditionLabel =
        CONDITIONS.find(
          (item) =>
            item.value === condition
        )?.label || condition;

      setMessage({
        type: "success",
        text: `Profile updated successfully! Condition set to: ${conditionLabel}`,
      });

      setPreviousCondition(
        condition
      );
    } catch {
      setMessage({
        type: "error",
        text:
          "Network error. Please try again.",
      });
    } finally {
      setSaving(false);

      window.setTimeout(
        () => setMessage(null),
        4000
      );
    }
  };

  const handleDeleteAccount =
    async () => {
      setDeleting(true);

      try {
        const response =
          await fetch(
            "/api/profile/delete-account",
            {
              method: "DELETE",
            }
          );

        const data =
          await response.json();

        if (data.success) {
          setShowDeleteConfirm(
            false
          );

          router.push("/sign-in");
          router.refresh();

          return;
        }

        setShowDeleteConfirm(false);

        setMessage({
          type: "error",
          text:
            data.error ||
            "Deletion failed. Please try again.",
        });
      } catch {
        setShowDeleteConfirm(false);

        setMessage({
          type: "error",
          text:
            "Network error. Please try again.",
        });
      } finally {
        setDeleting(false);
      }
    };

  if (loading) {
    return (
      <div className="animate-pulse rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="space-y-4">
          {[
            1,
            2,
            3,
            4,
            5,
          ].map((item) => (
            <div
              key={item}
              className="space-y-1"
            >
              <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-9 rounded bg-gray-100 dark:bg-gray-600" />
            </div>
          ))}

          <div className="mt-6 h-10 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  return (
    <>
      {message && (
        <Toast
          type={message.type}
          message={message.text}
          duration={5000}
          onClose={() =>
            setMessage(null)
          }
        />
      )}

      <ConfirmModal
        isOpen={
          showDeleteConfirm
        }
        title="Delete Account and Data?"
        message="Are you sure you want to delete your account? This action will permanently remove your account and all associated data. You will be logged out immediately, and your data cannot be recovered."
        confirmLabel="Delete Account"
        confirmColor="red"
        onConfirm={
          handleDeleteAccount
        }
        onCancel={() =>
          setShowDeleteConfirm(
            false
          )
        }
        loading={deleting}
      />

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center space-x-2 border-b border-gray-100 pb-4 dark:border-gray-700">
          <User className="h-5 w-5 text-gray-600 dark:text-gray-400" />

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Profile Information
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="firstName"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              First Name
            </label>

            <Input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(event) =>
                setFirstName(
                  event.target.value
                )
              }
              placeholder="Enter your first name"
              disabled={saving}
              className="rounded-lg border-gray-300 bg-gray-50 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>

          <div>
            <label
              htmlFor="middleName"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Middle Name{" "}
              <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                (optional)
              </span>
            </label>

            <Input
              id="middleName"
              type="text"
              value={middleName}
              onChange={(event) =>
                setMiddleName(
                  event.target.value
                )
              }
              placeholder="Enter your middle name"
              disabled={saving}
              className="rounded-lg border-gray-300 bg-gray-50 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>

          <div>
            <label
              htmlFor="lastName"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Last Name
            </label>

            <Input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(event) =>
                setLastName(
                  event.target.value
                )
              }
              placeholder="Enter your last name"
              disabled={saving}
              className="rounded-lg border-gray-300 bg-gray-50 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Email
            </label>

            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              placeholder="Enter your email"
              disabled={saving}
              className="rounded-lg border-gray-300 bg-gray-50 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
          </div>

          {role === "patient" && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
              <label
                htmlFor="patientId"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Patient ID
              </label>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="patientId"
                  type="text"
                  value={patientId}
                  readOnly
                  aria-label="Patient ID"
                  className="min-h-12 flex-1 rounded-xl border-blue-200 bg-white font-mono text-base font-bold tracking-[0.14em] text-gray-900 dark:border-blue-900 dark:bg-slate-950 dark:text-gray-100"
                />

                <button
                  type="button"
                  onClick={() =>
                    void copyPatientId()
                  }
                  disabled={
                    !patientId
                  }
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  aria-label="Copy Patient ID"
                >
                  {patientIdCopied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}

                  {patientIdCopied
                    ? "Copied!"
                    : "Copy"}
                </button>
              </div>

              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Share this only when a
                trusted Family member
                needs to identify your
                Patient account.
              </p>
            </div>
          )}

          {role === "patient" && (
            <div>
              <label
                htmlFor="age"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Age{" "}
                <span className="text-xs font-normal text-gray-400 dark:text-gray-500">
                  (optional)
                </span>
              </label>

              <Input
                id="age"
                type="number"
                value={age}
                onChange={(event) =>
                  setAge(
                    event.target.value
                  )
                }
                placeholder="Enter your age"
                min="1"
                max="120"
                disabled={saving}
                className="rounded-lg border-gray-300 bg-gray-50 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>
          )}

          {role === "patient" && (
            <div>
              <label
                htmlFor="condition"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Condition Managing
              </label>

              <select
                id="condition"
                value={condition}
                onChange={(event) =>
                  setCondition(
                    event.target.value
                  )
                }
                disabled={saving}
                className="h-9 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-1 text-sm text-gray-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-200 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:ring-blue-800"
              >
                {CONDITIONS.map(
                  (item) => (
                    <option
                      key={
                        item.value
                      }
                      value={
                        item.value
                      }
                    >
                      {
                        item.label
                      }
                    </option>
                  )
                )}
              </select>
            </div>
          )}

          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-2 w-full rounded-lg"
          >
            {saving
              ? "Saving..."
              : "Save Changes"}
          </Button>

          <Button
            type="button"
            onClick={() =>
              setShowPasswordModal(
                true
              )
            }
            disabled={saving}
            className="mt-2 w-full rounded-lg bg-slate-700 text-white hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-700"
          >
            Update Password
          </Button>

          <button
            type="button"
            onClick={() =>
              setShowDeleteConfirm(
                true
              )
            }
            disabled={saving}
            className="w-full rounded-lg border-2 border-red-200 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            Delete Account
          </button>
        </div>
      </div>

      <UpdatePasswordModal
        isOpen={showPasswordModal}
        onClose={() =>
          setShowPasswordModal(
            false
          )
        }
      />
    </>
  );
};

export default ProfileCard;