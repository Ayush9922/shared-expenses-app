import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, LogOut, Loader2, Calendar } from 'lucide-react';

/**
 * Dashboard Component.
 * Displays all active groups the user is part of and supports creating a new group.
 */
const Dashboard = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Group creation modal state
  const [showModal, setShowModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/groups');
      setGroups(response.data);
    } catch (err) {
      console.error('Fetch groups error:', err);
      setError('Failed to load groups. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      setCreating(true);
      setError('');
      const response = await axios.post('/groups', { name: newGroupName });
      
      // Add new group to top of list
      setGroups([response.data.group, ...groups]);
      setNewGroupName('');
      setShowModal(false);
      
      // Auto redirect to the newly created group's details
      navigate(`/groups/${response.data.group.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 pb-12 relative overflow-hidden">
      {/* Decorative gradient glowing spots in background */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header bar */}
      <header className="border-b border-slate-800/60 bg-dark-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-500/10 rounded-lg border border-brand-500/20">
              <Users className="w-6 h-6 text-brand-400" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">SplitwisePro</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-dark-800 text-slate-400 hover:text-white transition-colors border border-transparent hover:border-slate-800"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main dashboard body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        {/* Dashboard Title & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Your Expense Groups</h1>
            <p className="text-slate-400 mt-1">Select a group to manage details, expenses, and settlements.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary self-start sm:self-auto flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span>New Group</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-500/30 text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Groups Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
            <p className="text-slate-400 mt-4">Loading groups...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center max-w-2xl mx-auto border border-dashed border-slate-800">
            <Users className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">No Active Groups</h3>
            <p className="text-slate-400 mb-6">
              You are not a member of any shared expense groups yet. Create a new group or ask a flatmate to add you.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>Create Your First Group</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <div
                key={group.id}
                onClick={() => navigate(`/groups/${group.id}`)}
                className="glass-panel glass-panel-hover rounded-xl p-6 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-xl font-bold text-white mb-2 line-clamp-1">{group.name}</h3>
                  <p className="text-xs text-slate-400 mb-4 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Created {new Date(group.createdAt).toLocaleDateString()}</span>
                  </p>
                </div>
                <div className="border-t border-slate-800/60 pt-4 flex items-center justify-between text-sm">
                  <span className="text-slate-400">
                    Creator: <span className="text-white font-medium">{group.creatorName}</span>
                  </span>
                  <span className="bg-brand-500/10 text-brand-400 px-2.5 py-1 rounded-full text-xs font-semibold border border-brand-500/10">
                    {group.memberCount} active {group.memberCount === 1 ? 'member' : 'members'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Group Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-white mb-4">Create New Group</h2>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="form-label">Group Name</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Flat 302 Expenses"
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setNewGroupName('');
                  }}
                  className="btn-secondary"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-2"
                  disabled={creating || !newGroupName.trim()}
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Create Group</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
