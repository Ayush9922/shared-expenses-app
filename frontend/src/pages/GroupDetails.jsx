import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, UserPlus, UserMinus, Calendar, History, Shield, 
  DollarSign, RefreshCw, BarChart2, FileSpreadsheet, Plus, 
  Trash2, Edit, AlertTriangle, Check, CheckCircle2, AlertCircle, Info, Upload, Play
} from 'lucide-react';

/**
 * GroupDetails Component.
 * Integrates:
 * 1. Overview & Membership Timeline
 * 2. Expense Log (CRUD with Equal/Exact/Percentage splits)
 * 3. Settlements Log
 * 4. Net Balances & Optimized Settlement Plan
 * 5. CSV Import & Interactive Anomaly Resolver Engine
 */
const GroupDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  // Group details & Members state
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Navigation tabs: 'overview', 'expenses', 'settlements', 'balances', 'csv_import'
  const [activeTab, setActiveTab] = useState('overview');

  // Form states
  const [emailInput, setEmailInput] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);

  // Expenses state
  const [expenses, setExpenses] = useState([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    description: '',
    amount: '',
    currency: 'INR',
    exchangeRate: '1.0',
    date: new Date().toISOString().substring(0, 10),
    paidBy: '',
    splitType: 'EQUAL',
    participantShares: {} // userId: value (checked status for EQUAL, value for EXACT/PERCENTAGE)
  });

  // Settlements state
  const [settlements, setSettlements] = useState([]);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementForm, setSettlementForm] = useState({
    payerId: '',
    receiverId: '',
    amount: '',
    currency: 'INR',
    exchangeRate: '1.0',
    date: new Date().toISOString().substring(0, 10)
  });

  // Balances state
  const [balancesData, setBalancesData] = useState({ balances: [], settlementPlan: [] });

  // CSV Import state
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importSession, setImportSession] = useState(null);
  const [resolutions, setResolutions] = useState({}); // issueId: { action, adjustment }
  const [finalizingImport, setFinalizingImport] = useState(false);
  const [importReport, setImportReport] = useState(null);

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get(`/groups/${id}`);
      setGroup(response.data);
      
      // Default payer in expense form to current user if not set
      setExpenseForm(prev => ({
        ...prev,
        paidBy: prev.paidBy || currentUser?.id || ''
      }));
    } catch (err) {
      console.error('Fetch group details error:', err);
      setError(err.response?.data?.error || 'Failed to load group details.');
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      const response = await axios.get(`/groups/${id}/expenses`);
      setExpenses(response.data);
    } catch (err) {
      console.error('Fetch expenses error:', err);
    }
  };

  const fetchSettlements = async () => {
    try {
      const response = await axios.get(`/groups/${id}/settlements`);
      setSettlements(response.data);
    } catch (err) {
      console.error('Fetch settlements error:', err);
    }
  };

  const fetchBalances = async () => {
    try {
      const response = await axios.get(`/groups/${id}/balances`);
      setBalancesData(response.data);
    } catch (err) {
      console.error('Fetch balances error:', err);
    }
  };

  // Fetch tab-specific data on tab switch
  useEffect(() => {
    if (!id) return;
    if (activeTab === 'overview') {
      fetchGroupDetails();
    } else if (activeTab === 'expenses') {
      fetchExpenses();
    } else if (activeTab === 'settlements') {
      fetchSettlements();
    } else if (activeTab === 'balances') {
      fetchBalances();
    }
  }, [id, activeTab]);

  // Initial load
  useEffect(() => {
    fetchGroupDetails();
  }, [id]);

  // Reset expense form splits based on members list and split type
  useEffect(() => {
    if (!group) return;
    const initialShares = {};
    group.activeMembers.forEach(m => {
      // EQUAL defaults to true (checked), EXACT/PERCENTAGE defaults to empty string
      initialShares[m.userId] = expenseForm.splitType === 'EQUAL' ? true : '';
    });
    setExpenseForm(prev => ({
      ...prev,
      participantShares: initialShares
    }));
  }, [group, expenseForm.splitType, showExpenseModal]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    try {
      setAddingMember(true);
      setError('');
      await axios.post(`/groups/${id}/members`, { email: emailInput });
      setEmailInput('');
      await fetchGroupDetails();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member.');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this member? Historical expenses will remain valid, but they will be excluded from all future splits.')) {
      return;
    }

    try {
      setRemovingMemberId(memberId);
      setError('');
      await axios.delete(`/groups/${id}/members/${memberId}`);
      await fetchGroupDetails();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove member.');
    } finally {
      setRemovingMemberId(null);
    }
  };

  // --- EXPENSE CRUD HANDLERS ---
  const handleOpenAddExpense = () => {
    setEditingExpense(null);
    setExpenseForm({
      title: '',
      description: '',
      amount: '',
      currency: 'INR',
      exchangeRate: '1.0',
      date: new Date().toISOString().substring(0, 10),
      paidBy: currentUser?.id || '',
      splitType: 'EQUAL',
      participantShares: {}
    });
    setShowExpenseModal(true);
  };

  const handleOpenEditExpense = (exp) => {
    setEditingExpense(exp);
    const shares = {};
    
    // Map existing split values into form state
    group.activeMembers.forEach(m => {
      const part = exp.participants.find(p => p.userId === m.userId);
      if (part) {
        shares[m.userId] = exp.splitType === 'EQUAL' ? true : String(part.splitValue || part.amountOwed);
      } else {
        shares[m.userId] = exp.splitType === 'EQUAL' ? false : '';
      }
    });

    setExpenseForm({
      title: exp.title,
      description: exp.description || '',
      amount: String(exp.amount),
      currency: exp.currency,
      exchangeRate: String(exp.exchangeRate),
      date: new Date(exp.date).toISOString().substring(0, 10),
      paidBy: exp.paidById,
      splitType: exp.splitType,
      participantShares: shares
    });
    setShowExpenseModal(true);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    setError('');

    const { title, description, amount, currency, exchangeRate, date, paidBy, splitType, participantShares } = expenseForm;

    // Validate splits input
    const splits = [];
    if (splitType === 'EQUAL') {
      // For EQUAL, splits is just an array of checked userIds
      Object.keys(participantShares).forEach(uId => {
        if (participantShares[uId]) splits.push(uId);
      });
      if (splits.length === 0) {
        setError('At least one split participant must be selected.');
        return;
      }
    } else {
      // For EXACT/PERCENTAGE, splits is Array<{userId, value}>
      let sum = 0;
      let hasError = false;
      Object.keys(participantShares).forEach(uId => {
        const val = participantShares[uId];
        if (val !== undefined && val.trim() !== '') {
          const num = Number(val);
          if (isNaN(num) || num <= 0) {
            hasError = true;
          } else {
            splits.push({ userId: uId, value: num });
            sum += num;
          }
        }
      });

      if (hasError) {
        setError('All split values must be positive numbers.');
        return;
      }
      if (splits.length === 0) {
        setError('At least one split value must be entered.');
        return;
      }

      // Check sum validations locally
      if (splitType === 'EXACT') {
        if (Math.abs(Number(amount) - sum) > 0.02) {
          setError(`Sum of exact splits (${sum}) must equal the total amount (${amount}).`);
          return;
        }
      } else if (splitType === 'PERCENTAGE') {
        if (Math.round(sum) !== 100) {
          setError(`Sum of percentages (${sum}%) must equal exactly 100%.`);
          return;
        }
      }
    }

    const payload = {
      title,
      description,
      amount: Number(amount),
      currency,
      exchangeRate: Number(exchangeRate),
      date: new Date(date),
      paidBy,
      groupId: id,
      splitType,
      splits
    };

    try {
      if (editingExpense) {
        await axios.put(`/expenses/${editingExpense.id}`, payload);
      } else {
        await axios.post('/expenses', payload);
      }
      setShowExpenseModal(false);
      fetchExpenses();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save expense.');
    }
  };

  const handleDeleteExpense = async (expId) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await axios.delete(`/expenses/${expId}`);
      fetchExpenses();
    } catch (err) {
      console.error('Delete expense error:', err);
    }
  };

  // --- SETTLEMENT HANDLERS ---
  const handleOpenAddSettlement = (prefill = {}) => {
    setSettlementForm({
      payerId: prefill.payerId || '',
      receiverId: prefill.receiverId || '',
      amount: prefill.amount ? String(prefill.amount) : '',
      currency: 'INR',
      exchangeRate: '1.0',
      date: new Date().toISOString().substring(0, 10)
    });
    setShowSettlementModal(true);
  };

  const handleSaveSettlement = async (e) => {
    e.preventDefault();
    setError('');

    const { payerId, receiverId, amount, currency, exchangeRate, date } = settlementForm;

    if (!payerId || !receiverId) {
      setError('Both payer and receiver are required.');
      return;
    }
    if (payerId === receiverId) {
      setError('Payer and receiver cannot be the same person.');
      return;
    }

    try {
      await axios.post('/settlements', {
        payerId,
        receiverId,
        amount: Number(amount),
        currency,
        exchangeRate: Number(exchangeRate),
        date: new Date(date),
        groupId: id
      });
      setShowSettlementModal(false);
      fetchSettlements();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record settlement.');
    }
  };

  // --- CSV IMPORT HANDLERS ---
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
    setError('');
  };

  const handleCSVUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('groupId', id);

    try {
      setUploading(true);
      setError('');
      setImportReport(null);
      const response = await axios.post('/imports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportSession(response.data.session);
      
      // Initialize resolutions state to skips/default resolutions
      const initialResolutions = {};
      response.data.session.issues.forEach(issue => {
        initialResolutions[issue.id] = {
          action: issue.severity === 'ERROR' ? 'SKIP' : 'IMPORT', // Default resolve action
          adjustment: JSON.parse(issue.rowData) // Default to original row data for adjustments
        };
      });
      setResolutions(initialResolutions);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload CSV.');
    } finally {
      setUploading(false);
    }
  };

  const handleResolutionChange = (issueId, action, fieldName = null, val = null) => {
    setResolutions(prev => {
      const current = prev[issueId] || { action: 'SKIP', adjustment: {} };
      const nextAction = action;
      let nextAdjustment = { ...current.adjustment };

      if (fieldName) {
        nextAdjustment[fieldName] = val;
      }

      return {
        ...prev,
        [issueId]: {
          action: nextAction,
          adjustment: nextAdjustment
        }
      };
    });
  };

  const handleFinalizeImport = async () => {
    try {
      setFinalizingImport(true);
      setError('');
      const response = await axios.post(`/imports/${importSession.id}/resolve`, {
        resolutions,
        groupId: id
      });
      setImportReport(response.data);
      setImportSession(null);
      setSelectedFile(null);
      
      // Refresh expenses list
      fetchExpenses();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to finalize import.');
    } finally {
      setFinalizingImport(false);
    }
  };

  if (loading && !group) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium">Loading SplitwisePro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 pb-16 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header bar */}
      <header className="border-b border-slate-800/60 bg-dark-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 rounded-lg hover:bg-dark-800 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-bold text-xl text-white line-clamp-1">{group?.name}</h1>
          </div>
          <div className="bg-brand-500/10 text-brand-400 px-3 py-1 rounded-full text-xs font-semibold border border-brand-500/10 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>Creator: {group?.creatorName}</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {error && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-500/30 text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Dynamic Tab Navigation Bar */}
        <div className="flex border-b border-slate-800/60 mb-8 overflow-x-auto scrollbar-thin">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            Overview & Members
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-6 py-3.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'expenses'
                ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Expense Log
          </button>
          <button
            onClick={() => setActiveTab('settlements')}
            className={`px-6 py-3.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'settlements'
                ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            Settlements Log
          </button>
          <button
            onClick={() => setActiveTab('balances')}
            className={`px-6 py-3.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'balances'
                ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Balances & Settlement Plan
          </button>
          <button
            onClick={() => setActiveTab('csv_import')}
            className={`px-6 py-3.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'csv_import'
                ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            CSV Import Engine
          </button>
        </div>

        {/* --- TAB CONTENT AREA --- */}

        {/* 1. OVERVIEW & MEMBERS TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Add Member Form */}
              <div className="glass-panel p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-brand-400" />
                  <span>Add Group Member</span>
                </h3>
                <form onSubmit={handleAddMember} className="flex gap-3">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="form-input"
                    placeholder="member@example.com"
                    required
                  />
                  <button
                    type="submit"
                    disabled={addingMember || !emailInput.trim()}
                    className="btn-primary flex items-center justify-center px-6 shrink-0"
                  >
                    {addingMember ? 'Adding...' : 'Add'}
                  </button>
                </form>
                <p className="text-xs text-slate-500 mt-2">
                  Add registered flatmate users (e.g. Rohan, Aisha, Priya, Meera, Dev, Sam) by their email.
                </p>
              </div>

              {/* Active Members List */}
              <div className="glass-panel p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-4">
                  Active Group Members ({group?.activeMembers.length})
                </h3>
                <div className="divide-y divide-slate-800/60">
                  {group?.activeMembers.map((member) => (
                    <div key={member.userId} className="py-4 flex items-center justify-between first:pt-0 last:pb-0">
                      <div>
                        <p className="font-semibold text-white">{member.name}</p>
                        <p className="text-xs text-slate-400">{member.email}</p>
                      </div>
                      
                      {member.userId !== currentUser.id ? (
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Remove member"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded border border-slate-700 font-semibold">
                          You
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="glass-panel p-6 rounded-2xl h-fit">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-800/80 pb-3">
                <History className="w-5 h-5 text-indigo-400" />
                <span>Membership Timeline Log</span>
              </h3>
              <div className="space-y-6 mt-4 relative before:absolute before:inset-y-0 before:left-3.5 before:w-0.5 before:bg-slate-800">
                {group?.membershipHistory.map((history) => (
                  <div key={history.id} className="relative pl-8 text-sm">
                    <span className="absolute left-1.5 top-1.5 w-4.5 h-4.5 rounded-full bg-dark-900 border-2 border-indigo-500 flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    </span>
                    <div className="bg-dark-900/40 p-3 rounded-lg border border-slate-800/50">
                      <span className="font-semibold text-slate-200">{history.name}</span>
                      <p className="text-xs text-slate-400 mt-1">
                        Joined: {new Date(history.joinedAt).toLocaleString()}
                      </p>
                      {history.leftAt && (
                        <p className="text-xs text-red-400 mt-1">
                          Left: {new Date(history.leftAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. EXPENSES TAB */}
        {activeTab === 'expenses' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">Expenses Log</h3>
                <p className="text-sm text-slate-400">Track all expenses shared in this group</p>
              </div>
              <button onClick={handleOpenAddExpense} className="btn-primary flex items-center gap-2">
                <Plus className="w-5 h-5" />
                <span>Add Expense</span>
              </button>
            </div>

            {expenses.length === 0 ? (
              <div className="glass-panel p-12 text-center rounded-2xl border border-dashed border-slate-800">
                <DollarSign className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <h4 className="text-white font-bold mb-2">No Expenses Logged</h4>
                <p className="text-slate-400 mb-6">Create your first expense or upload a CSV report in the Import tab.</p>
                <button onClick={handleOpenAddExpense} className="btn-primary inline-flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  <span>Create Expense</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {expenses.map((exp) => (
                  <div key={exp.id} className="glass-panel p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-1">
                      <h4 className="text-lg font-bold text-white">{exp.title}</h4>
                      {exp.description && <p className="text-sm text-slate-400">{exp.description}</p>}
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span>Paid by <strong className="text-slate-300">{exp.paidByName}</strong></span>
                        <span>•</span>
                        <span>{new Date(exp.date).toLocaleDateString()}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-8 self-end md:self-auto">
                      <div className="text-right">
                        <span className="text-xl font-extrabold text-brand-400">
                          {exp.currency === 'INR' ? '₹' : exp.currency + ' '}{Number(exp.amount).toFixed(2)}
                        </span>
                        <p className="text-[10px] text-slate-500">
                          Split Type: <span className="font-semibold">{exp.participants[0]?.splitType}</span>
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenEditExpense(exp)}
                          className="p-2 hover:bg-dark-800 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-800/80"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors border border-slate-800/80"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. SETTLEMENTS TAB */}
        {activeTab === 'settlements' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">Settlements Log</h3>
                <p className="text-sm text-slate-400">Track all direct debt settlement payments</p>
              </div>
              <button onClick={() => handleOpenAddSettlement()} className="btn-primary flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                <span>Record Settlement</span>
              </button>
            </div>

            {settlements.length === 0 ? (
              <div className="glass-panel p-12 text-center rounded-2xl border border-dashed border-slate-800">
                <RefreshCw className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <h4 className="text-white font-bold mb-2">No Settlements Recorded</h4>
                <p className="text-slate-400 mb-6">Log manual bank transfers or payments between members to clear balances.</p>
                <button onClick={() => handleOpenAddSettlement()} className="btn-primary inline-flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  <span>Record Settlement</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {settlements.map((set) => (
                  <div key={set.id} className="glass-panel p-5 rounded-xl flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <span className="text-brand-400">{set.payerName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-indigo-400">{set.receiverName}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {new Date(set.date).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-extrabold text-emerald-400">
                        ₹{Number(set.amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. BALANCES TAB */}
        {activeTab === 'balances' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* User Positions */}
            <div className="lg:col-span-1 space-y-6">
              <div className="glass-panel p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-800/80 pb-3">Individual Net Positions</h3>
                <div className="space-y-4">
                  {balancesData.balances.map((b) => (
                    <div key={b.userId} className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-white">{b.name}</p>
                        <p className="text-[10px] text-slate-500">Paid: ₹{b.expensesPaid} | Owed: ₹{b.expensesOwed}</p>
                      </div>
                      <div className="text-right">
                        {b.netBalance > 0.01 ? (
                          <span className="text-emerald-400 font-bold text-sm bg-emerald-500/10 border border-emerald-500/10 px-2.5 py-1 rounded-full">
                            Owed ₹{b.netBalance.toFixed(2)}
                          </span>
                        ) : b.netBalance < -0.01 ? (
                          <span className="text-red-400 font-bold text-sm bg-red-500/10 border border-red-500/10 px-2.5 py-1 rounded-full">
                            Owes ₹{Math.abs(b.netBalance).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-full">
                            Settled
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Settlement Plan */}
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-panel p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-800/80 pb-3">Optimized Settlement Plan</h3>
                {balancesData.settlementPlan.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                    <p className="text-white font-bold text-lg">Group is Fully Settled!</p>
                    <p className="text-slate-400 text-sm mt-1">No outstanding balances are currently owed.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {balancesData.settlementPlan.map((plan, index) => (
                      <div key={index} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-dark-900/40 rounded-xl border border-slate-800/60 gap-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{plan.payerName}</span>
                          <span className="text-xs text-slate-500">pays</span>
                          <span className="font-semibold text-white">{plan.receiverName}</span>
                          <span className="text-brand-400 font-bold ml-2">₹{plan.amount}</span>
                        </div>
                        <button
                          onClick={() => handleOpenAddSettlement({
                            payerId: plan.payerId,
                            receiverId: plan.receiverId,
                            amount: plan.amount
                          })}
                          className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5 whitespace-nowrap self-end sm:self-auto"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Record Payment</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
          </div>
        )}

        {/* 5. CSV IMPORT ENGINE TAB */}
        {activeTab === 'csv_import' && (
          <div className="space-y-8">
            
            {/* Upload form */}
            {!importSession && (
              <div className="glass-panel p-8 rounded-2xl max-w-2xl mx-auto text-center border border-dashed border-slate-800">
                <Info className="w-10 h-10 text-brand-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Import Expenses CSV</h3>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                  Upload a spreadsheet file (`expenses_export.csv`) to parse, validate, and detect anomalies.
                  The system enforces strict anomaly checks for duplicates, date mismatches, splits, and currency formats.
                </p>

                <form onSubmit={handleCSVUpload} className="space-y-4">
                  <div className="flex flex-col items-center justify-center p-4 bg-dark-900/60 border border-slate-800 rounded-lg max-w-md mx-auto">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                      id="csv-file-upload"
                    />
                    <label
                      htmlFor="csv-file-upload"
                      className="cursor-pointer text-slate-300 hover:text-white flex items-center gap-2 font-medium"
                    >
                      <Upload className="w-5 h-5 text-brand-400" />
                      <span>{selectedFile ? selectedFile.name : 'Select CSV File'}</span>
                    </label>
                  </div>
                  
                  {selectedFile && (
                    <button
                      type="submit"
                      disabled={uploading}
                      className="btn-primary inline-flex items-center gap-2 px-8"
                    >
                      {uploading ? 'Processing File...' : 'Upload & Parse'}
                    </button>
                  )}
                </form>
              </div>
            )}

            {/* Finalized report feedback */}
            {importReport && (
              <div className="glass-panel p-6 rounded-2xl max-w-2xl mx-auto border border-emerald-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <div>
                    <h3 className="text-lg font-bold text-white">Import Report Successfully Finalized</h3>
                    <p className="text-slate-400 text-xs">Total items processed successfully.</p>
                  </div>
                </div>
                <div className="p-4 bg-dark-900/50 rounded-lg text-sm text-slate-300">
                  <p>Imported Expenses Count: <strong className="text-emerald-400">{importReport.importedCount}</strong></p>
                  <p className="mt-1">All action resolutions have been logged to the database system audit trails.</p>
                </div>
                <button
                  onClick={() => {
                    setImportReport(null);
                    setActiveTab('expenses');
                  }}
                  className="btn-primary mt-6 w-full"
                >
                  View Updated Expenses Log
                </button>
              </div>
            )}

            {/* Interactive anomaly resolver view */}
            {importSession && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-dark-900/40 p-4 rounded-xl border border-slate-800/60">
                  <div>
                    <h3 className="text-lg font-bold text-white">CSV Validation & Resolving Screen</h3>
                    <p className="text-xs text-slate-400">
                      File: {importSession.fileName} | Detected Anomalies: <span className="text-red-400 font-semibold">{importSession.anomalyCount}</span>
                    </p>
                  </div>
                  <button
                    onClick={handleFinalizeImport}
                    disabled={finalizingImport}
                    className="btn-primary flex items-center gap-1.5 self-end sm:self-auto"
                  >
                    <Play className="w-4 h-4" />
                    <span>{finalizingImport ? 'Finalizing...' : 'Finalize & Import Approved Rows'}</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {importSession.issues
                    .filter(issue => issue.issueType !== 'CLEAN')
                    .map((issue) => {
                      const rowData = JSON.parse(issue.rowData);
                      const currentRes = resolutions[issue.id] || { action: 'SKIP', adjustment: rowData };
                      
                      return (
                        <div key={issue.id} className="glass-panel p-6 rounded-xl border border-red-500/10 space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <span className="bg-red-500/10 border border-red-500/10 text-red-400 px-2 py-0.5 rounded text-[10px] font-bold">
                                Row {issue.rowIndex} • {issue.issueType}
                              </span>
                              <p className="text-sm text-slate-200 mt-1 font-semibold">{issue.message}</p>
                              <p className="text-xs text-slate-500">Raw Data: {JSON.stringify(rowData)}</p>
                            </div>

                            {/* Resolution actions select */}
                            <div className="flex items-center gap-3">
                              <label className="text-xs text-slate-400 font-semibold">Resolution:</label>
                              <select
                                value={currentRes.action}
                                onChange={(e) => handleResolutionChange(issue.id, e.target.value)}
                                className="bg-dark-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                              >
                                <option value="SKIP">Skip Row (Do Not Import)</option>
                                {issue.severity === 'WARNING' && <option value="IMPORT">Import with Warning (Approve)</option>}
                                <option value="ADJUST">Adjust Fields (Correct Row)</option>
                              </select>
                            </div>
                          </div>

                          {/* Adjustment fields view */}
                          {currentRes.action === 'ADJUST' && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-dark-900/60 rounded-lg border border-slate-800/80">
                              <div className="col-span-2">
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Description</label>
                                <input
                                  type="text"
                                  value={currentRes.adjustment.description || ''}
                                  onChange={(e) => handleResolutionChange(issue.id, 'ADJUST', 'description', e.target.value)}
                                  className="bg-dark-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 w-full mt-1"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Amount</label>
                                <input
                                  type="number"
                                  value={currentRes.adjustment.amount || ''}
                                  onChange={(e) => handleResolutionChange(issue.id, 'ADJUST', 'amount', e.target.value)}
                                  className="bg-dark-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 w-full mt-1"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Date (DD-MM-YYYY)</label>
                                <input
                                  type="text"
                                  value={currentRes.adjustment.date || ''}
                                  onChange={(e) => handleResolutionChange(issue.id, 'ADJUST', 'date', e.target.value)}
                                  className="bg-dark-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 w-full mt-1"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Currency</label>
                                <input
                                  type="text"
                                  value={currentRes.adjustment.currency || ''}
                                  onChange={(e) => handleResolutionChange(issue.id, 'ADJUST', 'currency', e.target.value)}
                                  className="bg-dark-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 w-full mt-1"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Payer</label>
                                <input
                                  type="text"
                                  value={currentRes.adjustment.paid_by || ''}
                                  onChange={(e) => handleResolutionChange(issue.id, 'ADJUST', 'paid_by', e.target.value)}
                                  className="bg-dark-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 w-full mt-1"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Split Type</label>
                                <input
                                  type="text"
                                  value={currentRes.adjustment.split_type || ''}
                                  onChange={(e) => handleResolutionChange(issue.id, 'ADJUST', 'split_type', e.target.value)}
                                  className="bg-dark-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 w-full mt-1"
                                  placeholder="equal, unequal, percentage, share"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Split With</label>
                                <input
                                  type="text"
                                  value={currentRes.adjustment.split_with || ''}
                                  onChange={(e) => handleResolutionChange(issue.id, 'ADJUST', 'split_with', e.target.value)}
                                  className="bg-dark-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 w-full mt-1"
                                  placeholder="Aisha;Rohan;Priya"
                                />
                              </div>
                              <div className="col-span-2">
                                <label className="text-[10px] text-slate-400 uppercase font-bold">Split Details</label>
                                <input
                                  type="text"
                                  value={currentRes.adjustment.split_details || ''}
                                  onChange={(e) => handleResolutionChange(issue.id, 'ADJUST', 'split_details', e.target.value)}
                                  className="bg-dark-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 w-full mt-1"
                                  placeholder="Rohan 700; Priya 400"
                                />
                              </div>
                              {issue.issueType === 'SETTLEMENT_AS_EXPENSE' && (
                                <div className="col-span-2 sm:col-span-4 flex items-center gap-2 border-t border-slate-800/80 pt-3 mt-1">
                                  <input
                                    type="checkbox"
                                    id={`settle-check-${issue.id}`}
                                    checked={currentRes.adjustment.importAsSettlement !== false}
                                    onChange={(e) => handleResolutionChange(issue.id, 'ADJUST', 'importAsSettlement', e.target.checked)}
                                    className="bg-dark-950 border border-slate-800 rounded focus:ring-0"
                                  />
                                  <label htmlFor={`settle-check-${issue.id}`} className="text-xs text-slate-300">
                                    Import as a direct **Settlement** instead of an Expense
                                  </label>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* --- EXPENSE ADD/EDIT MODAL --- */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg glass-panel p-6 rounded-2xl shadow-2xl my-8">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingExpense ? 'Edit Shared Expense' : 'Add Shared Expense'}
            </h2>
            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="form-label">Title / Description</label>
                  <input
                    type="text"
                    value={expenseForm.title}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, title: e.target.value }))}
                    className="form-input"
                    placeholder="e.g. Electricity Bill"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Amount</label>
                  <input
                    type="number"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="form-input"
                    placeholder="e.g. 1200"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Currency</label>
                  <select
                    value={expenseForm.currency}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, currency: e.target.value }))}
                    className="form-input"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Payer (Who Paid?)</label>
                  <select
                    value={expenseForm.paidBy}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, paidBy: e.target.value }))}
                    className="form-input"
                  >
                    {group?.activeMembers.map(m => (
                      <option key={m.userId} value={m.userId}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Split Method</label>
                  <select
                    value={expenseForm.splitType}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, splitType: e.target.value }))}
                    className="form-input"
                  >
                    <option value="EQUAL">EQUAL (split evenly)</option>
                    <option value="EXACT">EXACT (exact money amounts)</option>
                    <option value="PERCENTAGE">PERCENTAGE (%)</option>
                  </select>
                </div>
              </div>

              {/* Splits distribution list */}
              <div className="border-t border-slate-800/80 pt-4 mt-2">
                <label className="form-label mb-2">Split Participants Shares</label>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                  {group?.activeMembers.map(m => {
                    const isChecked = expenseForm.splitType === 'EQUAL' 
                      ? !!expenseForm.participantShares[m.userId]
                      : true;
                    
                    return (
                      <div key={m.userId} className="flex items-center justify-between gap-4 text-sm bg-dark-900/40 p-2.5 rounded border border-slate-800/60">
                        <div className="flex items-center gap-2">
                          {expenseForm.splitType === 'EQUAL' && (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => setExpenseForm(prev => ({
                                ...prev,
                                participantShares: {
                                  ...prev.participantShares,
                                  [m.userId]: e.target.checked
                                }
                              }))}
                              className="bg-dark-950 border border-slate-800 rounded focus:ring-0"
                            />
                          )}
                          <span className="text-slate-200 font-semibold">{m.name}</span>
                        </div>

                        {expenseForm.splitType !== 'EQUAL' && (
                          <div className="flex items-center gap-1.5 w-24">
                            <input
                              type="text"
                              value={expenseForm.participantShares[m.userId] || ''}
                              onChange={(e) => setExpenseForm(prev => ({
                                ...prev,
                                participantShares: {
                                  ...prev.participantShares,
                                  [m.userId]: e.target.value
                                }
                              }))}
                              placeholder={expenseForm.splitType === 'PERCENTAGE' ? 'e.g. 30' : 'e.g. 400'}
                              className="bg-dark-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 w-full text-right"
                            />
                            <span className="text-[10px] text-slate-500 font-bold">
                              {expenseForm.splitType === 'PERCENTAGE' ? '%' : '₹'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- RECORD SETTLEMENT MODAL --- */}
      {showSettlementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Record Settlement</h2>
            <form onSubmit={handleSaveSettlement} className="space-y-4">
              <div>
                <label className="form-label">Payer (Who Paid?)</label>
                <select
                  value={settlementForm.payerId}
                  onChange={(e) => setSettlementForm(prev => ({ ...prev, payerId: e.target.value }))}
                  className="form-input"
                  required
                >
                  <option value="">Select Payer</option>
                  {group?.activeMembers.map(m => (
                    <option key={m.userId} value={m.userId}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Receiver (Who Received?)</label>
                <select
                  value={settlementForm.receiverId}
                  onChange={(e) => setSettlementForm(prev => ({ ...prev, receiverId: e.target.value }))}
                  className="form-input"
                  required
                >
                  <option value="">Select Receiver</option>
                  {group?.activeMembers.map(m => (
                    <option key={m.userId} value={m.userId}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Amount (₹)</label>
                <input
                  type="number"
                  value={settlementForm.amount}
                  onChange={(e) => setSettlementForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="form-input"
                  placeholder="e.g. 500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowSettlementModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default GroupDetails;
