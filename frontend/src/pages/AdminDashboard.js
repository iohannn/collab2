import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  Users, TrendingUp, DollarSign, Flag, Search, Shield,
  Ban, CheckCircle, XCircle, Eye, Trash2, AlertTriangle,
  Building2, UserCircle, Crown, BarChart3
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = () => {
  const { user, getAuthHeaders, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [collaborations, setCollaborations] = useState([]);
  const [reports, setReports] = useState([]);
  const [commissionRate, setCommissionRate] = useState(10);
  const [commissions, setCommissions] = useState({ commissions: [], total: 0, summary: { total_commission: 0, total_gross: 0 } });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    if (isAuthenticated && user?.is_admin) {
      fetchAdminData();
    } else if (isAuthenticated && !user?.is_admin) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, user]);

  const fetchAdminData = async () => {
    try {
      const [statsRes, usersRes, collabsRes, reportsRes, commRateRes, commissionsRes] = await Promise.all([
        fetch(`${API}/admin/stats`, { headers: getAuthHeaders(), credentials: 'include' }),
        fetch(`${API}/admin/users?limit=50`, { headers: getAuthHeaders(), credentials: 'include' }),
        fetch(`${API}/admin/collaborations?limit=50`, { headers: getAuthHeaders(), credentials: 'include' }),
        fetch(`${API}/admin/reports?limit=50`, { headers: getAuthHeaders(), credentials: 'include' }),
        fetch(`${API}/settings/commission`, { headers: getAuthHeaders(), credentials: 'include' }),
        fetch(`${API}/admin/commissions?limit=50`, { headers: getAuthHeaders(), credentials: 'include' }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }
      if (collabsRes.ok) {
        const data = await collabsRes.json();
        setCollaborations(data.collaborations || []);
      }
      if (reportsRes.ok) {
        const data = await reportsRes.json();
        setReports(data.reports || []);
      }
      if (commRateRes.ok) {
        const data = await commRateRes.json();
        setCommissionRate(data.commission_rate);
      }
      if (commissionsRes.ok) {
        const data = await commissionsRes.json();
        setCommissions(data);
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (userId, updates) => {
    try {
      const response = await fetch(`${API}/admin/users/${userId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        toast.success('User updated');
        fetchAdminData();
        setSelectedUser(null);
      } else {
        toast.error('Failed to update user');
      }
    } catch (error) {
      toast.error('Error updating user');
    }
  };

  const handleDeleteCollab = async (collabId) => {
    if (!window.confirm('Are you sure you want to delete this collaboration?')) return;

    try {
      const response = await fetch(`${API}/admin/collaborations/${collabId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Collaboration deleted');
        fetchAdminData();
      } else {
        toast.error('Failed to delete');
      }
    } catch (error) {
      toast.error('Error deleting collaboration');
    }
  };

  const handleResolveReport = async (reportId, status, action) => {
    try {
      const response = await fetch(`${API}/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ status, action }),
      });

      if (response.ok) {
        toast.success('Report resolved');
        fetchAdminData();
        setSelectedReport(null);
      } else {
        toast.error('Failed to resolve report');
      }
    } catch (error) {
      toast.error('Error resolving report');
    }
  };

  const handleUpdateCommission = async () => {
    try {
      const response = await fetch(`${API}/settings/commission`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ commission_rate: commissionRate }),
      });

      if (response.ok) {
        toast.success(`Comision actualizat la ${commissionRate}%`);
      } else {
        toast.error('Eroare la actualizarea comisionului');
      }
    } catch (error) {
      toast.error('Eroare la actualizarea comisionului');
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = search
      ? u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchesFilter =
      userFilter === 'all' ||
      (userFilter === 'brand' && u.user_type === 'brand') ||
      (userFilter === 'influencer' && u.user_type === 'influencer') ||
      (userFilter === 'pro' && u.is_pro);
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user?.is_admin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Admin Access Required</h2>
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-heading font-bold">Admin Panel</h1>
          <Badge className="badge-pro">
            <Crown className="w-3 h-3 mr-1" />
            ADMIN
          </Badge>
        </div>

        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white border border-border rounded-xl p-4">
              <Users className="w-5 h-5 text-primary mb-2" />
              <p className="text-2xl font-bold">{stats.users.total}</p>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </div>
            <div className="bg-white border border-border rounded-xl p-4">
              <Building2 className="w-5 h-5 text-secondary mb-2" />
              <p className="text-2xl font-bold">{stats.users.brands}</p>
              <p className="text-xs text-muted-foreground">Brands</p>
            </div>
            <div className="bg-white border border-border rounded-xl p-4">
              <UserCircle className="w-5 h-5 text-green-500 mb-2" />
              <p className="text-2xl font-bold">{stats.users.influencers}</p>
              <p className="text-xs text-muted-foreground">Influencers</p>
            </div>
            <div className="bg-white border border-border rounded-xl p-4">
              <Crown className="w-5 h-5 text-yellow-500 mb-2" />
              <p className="text-2xl font-bold">{stats.users.pro}</p>
              <p className="text-xs text-muted-foreground">PRO Users</p>
            </div>
            <div className="bg-white border border-border rounded-xl p-4">
              <TrendingUp className="w-5 h-5 text-blue-500 mb-2" />
              <p className="text-2xl font-bold">{stats.collaborations.active}</p>
              <p className="text-xs text-muted-foreground">Active Collabs</p>
            </div>
            <div className="bg-white border border-border rounded-xl p-4">
              <DollarSign className="w-5 h-5 text-green-600 mb-2" />
              <p className="text-2xl font-bold">€{stats.revenue.total}</p>
              <p className="text-xs text-muted-foreground">Revenue</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users" data-testid="admin-tab-users">
              <Users className="w-4 h-4 mr-2" />
              Users ({users.length})
            </TabsTrigger>
            <TabsTrigger value="collaborations" data-testid="admin-tab-collabs">
              <TrendingUp className="w-4 h-4 mr-2" />
              Collaborations ({collaborations.length})
            </TabsTrigger>
            <TabsTrigger value="reports" data-testid="admin-tab-reports">
              <Flag className="w-4 h-4 mr-2" />
              Reports ({reports.filter((r) => r.status === 'pending').length})
            </TabsTrigger>
            <TabsTrigger value="commission" data-testid="admin-tab-commission">
              <DollarSign className="w-4 h-4 mr-2" />
              Comisioane
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <div className="bg-white border border-border rounded-xl p-6">
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                    data-testid="admin-search-users"
                  />
                </div>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger className="w-40" data-testid="admin-filter-users">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="brand">Brands</SelectItem>
                    <SelectItem value="influencer">Influencers</SelectItem>
                    <SelectItem value="pro">PRO Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">User</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Created</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.user_id} className="border-b border-border hover:bg-muted/30">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              {u.picture ? (
                                <img src={u.picture} alt="" className="w-8 h-8 rounded-full" />
                              ) : (
                                <span className="text-sm font-medium">{u.name?.[0]}</span>
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{u.name}</p>
                              <p className="text-sm text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="capitalize">{u.user_type}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1">
                            {u.is_pro && <Badge className="bg-yellow-100 text-yellow-700">PRO</Badge>}
                            {u.is_banned && <Badge className="bg-red-100 text-red-700">Banned</Badge>}
                            {u.is_admin && <Badge className="bg-purple-100 text-purple-700">Admin</Badge>}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedUser(u)}
                            data-testid={`admin-user-${u.user_id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Collaborations Tab */}
          <TabsContent value="collaborations">
            <div className="bg-white border border-border rounded-xl p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Collaboration</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Brand</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Platform</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Stats</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collaborations.map((c) => (
                      <tr key={c.collab_id} className="border-b border-border hover:bg-muted/30">
                        <td className="py-3 px-4">
                          <p className="font-medium truncate max-w-xs">{c.title}</p>
                          <p className="text-sm text-muted-foreground">€{c.budget_min} - €{c.budget_max || c.budget_min}</p>
                        </td>
                        <td className="py-3 px-4">{c.brand_name}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="capitalize">{c.platform}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm">{c.views || 0} views</p>
                          <p className="text-sm text-muted-foreground">{c.applicants_count} applicants</p>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                            {c.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleDeleteCollab(c.collab_id)}
                            data-testid={`admin-delete-${c.collab_id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <div className="bg-white border border-border rounded-xl p-6">
              {reports.length === 0 ? (
                <div className="text-center py-12">
                  <Flag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No reports yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reports.map((r) => (
                    <div key={r.report_id} className="border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className={`w-4 h-4 ${r.status === 'pending' ? 'text-yellow-500' : 'text-gray-400'}`} />
                            <Badge className={r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}>
                              {r.status}
                            </Badge>
                          </div>
                          <p className="font-medium">{r.reason}</p>
                          <p className="text-sm text-muted-foreground mt-1">{r.details}</p>
                          <div className="flex gap-4 mt-3 text-sm">
                            <span>Reporter: {r.reporter?.name || 'Unknown'}</span>
                            <span>Reported: {r.reported_user?.name || 'Unknown'}</span>
                          </div>
                        </div>
                        {r.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResolveReport(r.report_id, 'resolved', 'dismiss')}
                            >
                              Dismiss
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-yellow-600"
                              onClick={() => handleResolveReport(r.report_id, 'resolved', 'warn_user')}
                            >
                              Warn
                            </Button>
                            <Button
                              size="sm"
                              className="bg-destructive text-white"
                              onClick={() => handleResolveReport(r.report_id, 'resolved', 'ban_user')}
                            >
                              <Ban className="w-4 h-4 mr-1" />
                              Ban
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Commission Tab */}
          <TabsContent value="commission">
            <div className="space-y-6">
              {/* Commission Settings */}
              <div className="bg-white border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Setări Comision</h3>
                <div className="flex items-end gap-4">
                  <div className="flex-1 max-w-xs">
                    <label className="text-sm font-medium text-muted-foreground block mb-2">Rata comisionului (%)</label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                      data-testid="commission-rate-input"
                    />
                  </div>
                  <Button onClick={handleUpdateCommission} data-testid="save-commission-btn">
                    Salvează
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  Comisionul se aplică automat la finalizarea colaborărilor. Rata curentă: <strong>{commissionRate}%</strong>
                </p>
              </div>

              {/* Commission Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-border rounded-xl p-6 text-center">
                  <DollarSign className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-3xl font-bold">{commissions.total}</p>
                  <p className="text-sm text-muted-foreground">Total Tranzacții</p>
                </div>
                <div className="bg-white border border-border rounded-xl p-6 text-center">
                  <TrendingUp className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                  <p className="text-3xl font-bold">€{commissions.summary.total_gross.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Valoare Brută</p>
                </div>
                <div className="bg-white border border-border rounded-xl p-6 text-center">
                  <DollarSign className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="text-3xl font-bold">€{commissions.summary.total_commission.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Total Comisioane</p>
                </div>
              </div>

              {/* Commissions List */}
              {commissions.commissions.length > 0 && (
                <div className="bg-white border border-border rounded-xl p-6">
                  <h3 className="text-lg font-semibold mb-4">Istoric Comisioane</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">ID</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Sumă Brută</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Comision</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Sumă Netă</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissions.commissions.map((c) => (
                          <tr key={c.commission_id} className="border-b border-border hover:bg-muted/30">
                            <td className="py-3 px-4 text-sm font-mono">{c.commission_id}</td>
                            <td className="py-3 px-4 font-medium">€{c.gross_amount}</td>
                            <td className="py-3 px-4 text-primary font-medium">€{c.commission_amount} ({c.commission_rate}%)</td>
                            <td className="py-3 px-4">€{c.net_amount}</td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* User Edit Dialog */}
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage User</DialogTitle>
              <DialogDescription>{selectedUser?.email}</DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    {selectedUser.picture ? (
                      <img src={selectedUser.picture} alt="" className="w-12 h-12 rounded-full" />
                    ) : (
                      <span className="text-lg font-medium">{selectedUser.name?.[0]}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{selectedUser.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser.user_type}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={selectedUser.is_pro ? 'destructive' : 'outline'}
                    onClick={() => handleUpdateUser(selectedUser.user_id, { is_pro: !selectedUser.is_pro })}
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    {selectedUser.is_pro ? 'Remove PRO' : 'Give PRO'}
                  </Button>
                  <Button
                    variant={selectedUser.is_banned ? 'outline' : 'destructive'}
                    onClick={() => handleUpdateUser(selectedUser.user_id, { is_banned: !selectedUser.is_banned })}
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    {selectedUser.is_banned ? 'Unban' : 'Ban User'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminDashboard;
