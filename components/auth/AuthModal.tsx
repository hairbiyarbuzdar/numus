import React, { useEffect } from "react";
import { X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import AuthFlow from "./AuthFlow";

const AuthModal: React.FC = () => {
  const { authModalOpen, closeAuthModal } = useAuth();

  useEffect(() => {
    if (!authModalOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAuthModal();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onEscape);
    };
  }, [authModalOpen, closeAuthModal]);

  if (!authModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[90]">
      <button className="absolute inset-0 bg-black/55" onClick={closeAuthModal} aria-label="Close auth modal" />
      <div className="absolute right-1/2 top-1/2 w-[92%] max-w-xl -translate-y-1/2 translate-x-1/2">
        <div className="relative rounded-3xl bg-white p-4 shadow-2xl">
          <button
            onClick={closeAuthModal}
            className="absolute right-4 top-4 rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <AuthFlow compact onSuccess={closeAuthModal} />
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
