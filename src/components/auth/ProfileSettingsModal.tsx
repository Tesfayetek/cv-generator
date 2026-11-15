import React, { useState } from 'react';
import { CheckCircle2, LogOut, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ProfileSettingsModalProps {
  onClose: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ onClose }) => {
  const { userProfile, firebaseUser, isVerified, updateProfileInfo, sendResetEmail, logout } =
    useAuth();
  const [fullName, setFullName] = useState(userProfile?.fullName || '');
  const [defaultTitle, setDefaultTitle] = useState(userProfile?.defaultTitle || '');
  const [location, setLocation] = useState(userProfile?.location || '');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      await updateProfileInfo({ fullName, defaultTitle, location });
      setNotice('Profile updated successfully.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#142B4A]">Profile Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
          <div>
            <span className="font-semibold text-slate-800">Email:</span> {firebaseUser?.email}
          </div>
          <div>
            <span className="font-semibold text-slate-800">Verification:</span>{' '}
            {isVerified ? 'Verified' : 'Pending email verification'}
          </div>
        </div>

        {notice && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Default Professional Title</label>
            <input
              type="text"
              value={defaultTitle}
              onChange={(e) => setDefaultTitle(e.target.value)}
              placeholder="e.g., Senior Programme Manager"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Geneva, Switzerland"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={async () => {
                if (firebaseUser?.email) {
                  await sendResetEmail(firebaseUser.email);
                  setNotice('Password reset link sent to your email.');
                }
              }}
              className="text-xs font-semibold text-[#2864A6] hover:underline"
            >
              Send Password Reset Email
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold bg-[#142B4A] text-white rounded-lg"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
          <button
            type="button"
            onClick={async () => {
              await logout();
              onClose();
            }}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
