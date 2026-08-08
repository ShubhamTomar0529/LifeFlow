import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Droplet,
  Calendar,
  Users,
  Activity,
  Clock,
  MapPin,
  Phone,
  Mail,
  User,
  Shield,
  Award,
  Heart,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  Download,
  Share2,
  X,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { toast } from "react-hot-toast";

const API_URL = "https://lifeflow-backend-z9b4.onrender.com/api/donor";

const DonorDashboard = () => {
  const [dashboard, setDashboard]           = useState(null);
  const [donor, setDonor]                   = useState(null);
  const [history, setHistory]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);

  // ── donation modal state ──
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [availableCamps, setAvailableCamps]   = useState([]);
  const [selectedCamp, setSelectedCamp]       = useState(null);
  const [donating, setDonating]               = useState(false);
  const [campsLoading, setCampsLoading]       = useState(false);

  // ─────────────────────────────────────────────────────────
  // Data fetching
  // ─────────────────────────────────────────────────────────

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const [profileRes, historyRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/profile`,  { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/history`,  { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/stats`,    { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: {} })),
      ]);

      const donorData = profileRes.data.donor || profileRes.data;
      setDonor(donorData);

      let historyData = historyRes.data.history || historyRes.data.donations || (Array.isArray(historyRes.data) ? historyRes.data : []);
      setHistory(historyData);

      const totalDonations  = historyData.length;
      const livesImpacted   = totalDonations * 3;
      const achievementLevel = totalDonations >= 10 ? "Gold" : totalDonations >= 5 ? "Silver" : "Bronze";
      const nextMilestone   = totalDonations < 5 ? 5 : totalDonations < 10 ? 10 : 15;

      setDashboard({
        stats: { totalDonations, livesImpacted, achievementLevel, nextMilestone, ...statsRes.data },
        recentActivity: historyData.slice(0, 5),
      });
    } catch (error) {
      console.error("🚨 Donor Dashboard Error:", error);
      toast.error(error.response?.data?.message || "Failed to load dashboard");
    }
  };

  const fetchAvailableCamps = async () => {
    setCampsLoading(true);
    try {
      const token = localStorage.getItem("token");
      // Fetch Upcoming + Ongoing camps — we'll show both
      const res = await axios.get(`${API_URL}/camps?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const all = res.data?.data?.camps || [];
      // Only show camps that can still accept donations
      const active = all.filter((c) => ["Upcoming", "Ongoing"].includes(c.status));
      setAvailableCamps(active);
    } catch (err) {
      console.error("Fetch camps error:", err);
      toast.error("Failed to load blood camps");
    } finally {
      setCampsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // Donation handler
  // ─────────────────────────────────────────────────────────

  const handleDonate = async () => {
    if (!selectedCamp) {
      toast.error("Please select a blood camp first");
      return;
    }

    setDonating(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_URL}/donate`,
        { campId: selectedCamp._id, quantity: 1 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(res.data.message || "Donation recorded successfully!");

      // Close modal and reset
      setShowDonateModal(false);
      setSelectedCamp(null);

      // Refresh dashboard so counts update immediately
      await fetchDashboardData();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to record donation";
      toast.error(msg);
    } finally {
      setDonating(false);
    }
  };

  const openDonateModal = () => {
    setSelectedCamp(null);
    setShowDonateModal(true);
    fetchAvailableCamps();
  };

  const closeDonateModal = () => {
    if (donating) return; // prevent accidental close while submitting
    setShowDonateModal(false);
    setSelectedCamp(null);
  };

  // ─────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
    toast.success("Dashboard updated");
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchDashboardData();
      setLoading(false);
    };
    loadData();
  }, []);

  // ─────────────────────────────────────────────────────────
  // Derived values
  // ─────────────────────────────────────────────────────────

  const isEligible       = donor?.eligibleToDonate || false;
  const nextDonationDate = donor?.nextEligibleDate ? new Date(donor.nextEligibleDate) : null;
  const daysUntilEligible =
    nextDonationDate ? Math.max(0, Math.ceil((nextDonationDate - new Date()) / (1000 * 60 * 60 * 24))) : 0;

  // ─────────────────────────────────────────────────────────
  // Loading screen
  // ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse mb-4">
            <Heart className="w-12 h-12 text-red-500 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading Donor Dashboard</h2>
          <p className="text-gray-500">Preparing your donation journey...</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-white p-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl">
              <Heart className="w-6 h-6 text-red-600" />
            </div>
            Donor Dashboard
          </h1>
          <p className="text-gray-600 mt-2">Track your donation journey and impact</p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="mt-4 lg:mt-0 flex items-center gap-2 px-4 py-2 bg-white border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* ── Eligibility + Donate Banner ── */}
      {isEligible ? (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-xl">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-green-800 text-lg">You are eligible to donate blood!</p>
              <p className="text-green-600 text-sm">Your donation can save up to 3 lives today.</p>
            </div>
          </div>
          <button
            onClick={openDonateModal}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-lg transition-all hover:shadow-xl hover:scale-105"
          >
            <Droplet className="w-5 h-5" />
            Donate Blood Now
          </button>
        </div>
      ) : (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-xl">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="font-semibold text-yellow-800">Next donation available in {daysUntilEligible} day{daysUntilEligible !== 1 ? "s" : ""}</p>
              <p className="text-yellow-600 text-sm">
                {nextDonationDate
                  ? `You can donate again from ${nextDonationDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
                  : "Minimum 90-day gap required between donations"}
              </p>
            </div>
          </div>
          <button
            onClick={openDonateModal}
            className="flex items-center gap-2 px-5 py-2.5 border-2 border-yellow-400 text-yellow-700 font-medium rounded-xl hover:bg-yellow-100 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            View Blood Camps
          </button>
        </div>
      )}

      {/* ── Donor Profile Card ── */}
      {donor && (
        <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <User className="w-5 h-5 text-red-600" />
              Donor Profile
            </h2>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${isEligible ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
              {isEligible ? "Eligible to Donate" : "In Cooldown"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <LabInfo icon={<Mail className="w-4 h-4" />}   label="Email"       value={donor.email} />
            <LabInfo icon={<Phone className="w-4 h-4" />}  label="Phone"       value={donor.phone} />
            <LabInfo icon={<Droplet className="w-4 h-4" />} label="Blood Type" value={donor.bloodGroup} />
            <LabInfo
              icon={<MapPin className="w-4 h-4" />}
              label="Location"
              value={`${donor.address?.city || "N/A"}, ${donor.address?.state || "N/A"}`}
              truncate
            />
          </div>
        </div>
      )}

      {/* ── Key Metrics ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          icon={<Droplet className="w-6 h-6" />}
          label="Total Donations"
          value={dashboard?.stats?.totalDonations || 0}
          subtitle={`${dashboard?.stats?.nextMilestone || 5} to next milestone`}
          color="red"
        />
        <MetricCard
          icon={<Users className="w-6 h-6" />}
          label="Lives Impacted"
          value={dashboard?.stats?.livesImpacted || 0}
          subtitle="3 lives per donation"
          color="green"
        />
        <MetricCard
          icon={<Award className="w-6 h-6" />}
          label="Achievement Level"
          value={dashboard?.stats?.achievementLevel || "Bronze"}
          subtitle="Keep donating to level up"
          color="purple"
        />
        <MetricCard
          icon={<Calendar className="w-6 h-6" />}
          label="Next Eligible"
          value={isEligible ? "Now!" : nextDonationDate ? nextDonationDate.toLocaleDateString() : "Now!"}
          subtitle={isEligible ? "Ready to donate" : `${daysUntilEligible} days left`}
          color="blue"
        />
      </div>

      {/* ── History + Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Section title="Donation History" icon={<Activity className="w-5 h-5" />} subtitle="Your blood donation journey">
          {history.length > 0 ? (
            <div className="space-y-3">
              {history.slice(0, 5).map((donation, index) => (
                <DonationHistoryItem key={donation.id || index} donation={donation} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Droplet className="w-8 h-8" />}
              message="No donation history yet"
              actionText="Donate Blood Now"
              onAction={isEligible ? openDonateModal : undefined}
            />
          )}
        </Section>

        <Section title="Recent Activity" icon={<Clock className="w-5 h-5" />} subtitle="Your latest donation records">
          {dashboard?.recentActivity?.length > 0 ? (
            <div className="space-y-4">
              {dashboard.recentActivity.map((activity, index) => (
                <ActivityCard key={activity.id || index} activity={activity} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Activity className="w-8 h-8" />} message="No recent activity" />
          )}
        </Section>
      </div>

      {/* ── Quick Actions ── */}
      <Section title="Quick Actions" icon={<Shield className="w-5 h-5" />} subtitle="Manage your donor profile" className="mt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ActionCard
            icon={<Droplet className="w-5 h-5" />}
            title={isEligible ? "Donate Blood" : "View Camps"}
            description={isEligible ? "Record your donation at a blood camp" : "Find upcoming blood donation camps"}
            onClick={openDonateModal}
            color="red"
            highlight={isEligible}
          />
          <ActionCard
            icon={<Download className="w-5 h-5" />}
            title="Download Certificate"
            description="Get your donation certificate"
            onClick={() => toast.success("Certificate download started!")}
            color="blue"
          />
          <ActionCard
            icon={<Share2 className="w-5 h-5" />}
            title="Share Achievement"
            description="Share your impact with others"
            onClick={() => toast.success("Share your life-saving journey!")}
            color="green"
          />
          <ActionCard
            icon={<Users className="w-5 h-5" />}
            title="Invite Friends"
            description="Grow the donor community"
            onClick={() => toast.success("Invite friends to become donors!")}
            color="purple"
          />
        </div>
      </Section>

      {/* ── Health Overview ── */}
      {donor && (
        <Section title="Health Overview" icon={<Heart className="w-5 h-5" />} subtitle="Your health metrics" className="mt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <HealthStat label="Age"           value={donor.age ? `${donor.age} years` : "N/A"}       icon={<User className="w-4 h-4" />} />
            <HealthStat label="Weight"        value={donor.weight ? `${donor.weight} kg` : "N/A"}   icon={<Activity className="w-4 h-4" />} />
            <HealthStat label="Last Donation" value={donor.lastDonationDate ? new Date(donor.lastDonationDate).toLocaleDateString() : "Never"} icon={<Calendar className="w-4 h-4" />} />
            <HealthStat label="Donor Since"   value={donor.createdAt ? new Date(donor.createdAt).getFullYear() : new Date().getFullYear()} icon={<Award className="w-4 h-4" />} />
          </div>
        </Section>
      )}

      {/* ═══════════════════════════════════════════════════════
          Donation Modal
      ═══════════════════════════════════════════════════════ */}
      {showDonateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-xl">
                  <Droplet className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Donate Blood</h2>
                  <p className="text-sm text-gray-500">Select a blood camp near you to record your donation</p>
                </div>
              </div>
              <button
                onClick={closeDonateModal}
                disabled={donating}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Donor Info Strip */}
            {donor && (
              <div className="px-6 py-3 bg-red-50 border-b border-red-100 flex flex-wrap items-center gap-4 text-sm flex-shrink-0">
                <span className="font-semibold text-red-700">{donor.fullName}</span>
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-bold">{donor.bloodGroup}</span>
                {isEligible ? (
                  <span className="flex items-center gap-1 text-green-700 font-medium">
                    <CheckCircle className="w-4 h-4" /> Eligible to donate
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-yellow-700 font-medium">
                    <AlertCircle className="w-4 h-4" /> Not eligible until {nextDonationDate?.toLocaleDateString()}
                  </span>
                )}
              </div>
            )}

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {!isEligible ? (
                /* Ineligible state */
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-yellow-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Not Eligible Yet</h3>
                  <p className="text-gray-600 mb-1">
                    You need to wait at least 90 days between donations for your body to replenish.
                  </p>
                  {nextDonationDate && (
                    <p className="text-yellow-700 font-medium">
                      You can donate again from{" "}
                      <span className="underline">
                        {nextDonationDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    </p>
                  )}
                </div>
              ) : campsLoading ? (
                /* Loading camps */
                <div className="text-center py-10">
                  <Loader2 className="w-8 h-8 text-red-500 mx-auto animate-spin mb-3" />
                  <p className="text-gray-600">Loading nearby blood camps…</p>
                </div>
              ) : availableCamps.length === 0 ? (
                /* No camps */
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">No Camps Available</h3>
                  <p className="text-gray-600">
                    There are no upcoming or ongoing blood donation camps at the moment.
                    Check back soon or visit the Blood Camps page for future events.
                  </p>
                </div>
              ) : (
                /* Camp list */
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 mb-4">
                    {availableCamps.length} camp{availableCamps.length !== 1 ? "s" : ""} available — select one to donate:
                  </p>
                  {availableCamps.map((camp) => (
                    <button
                      key={camp._id}
                      onClick={() => setSelectedCamp(camp)}
                      className={`w-full text-left p-4 border-2 rounded-xl transition-all duration-200 ${
                        selectedCamp?._id === camp._id
                          ? "border-red-500 bg-red-50 shadow-md"
                          : "border-gray-200 hover:border-red-300 hover:bg-red-50/50"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold text-gray-800 pr-4">{camp.title}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                          camp.status === "Ongoing" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {camp.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-red-400 flex-shrink-0" />
                          {new Date(camp.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-red-400 flex-shrink-0" />
                          {camp.time?.start} – {camp.time?.end}
                        </div>
                        <div className="flex items-center gap-2 sm:col-span-2">
                          <MapPin className="w-4 h-4 text-red-400 flex-shrink-0" />
                          {camp.location?.venue}, {camp.location?.city}, {camp.location?.state}
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-red-400 flex-shrink-0" />
                          {camp.actualDonors || 0} / {camp.expectedDonors} donors
                        </div>
                      </div>

                      {selectedCamp?._id === camp._id && (
                        <div className="mt-2 flex items-center gap-2 text-red-600 text-sm font-medium">
                          <CheckCircle className="w-4 h-4" />
                          Selected — click "Confirm Donation" below
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-100 flex-shrink-0">
              {isEligible && availableCamps.length > 0 ? (
                <div className="flex gap-3">
                  <button
                    onClick={closeDonateModal}
                    disabled={donating}
                    className="flex-1 py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDonate}
                    disabled={!selectedCamp || donating}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {donating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Recording donation…
                      </>
                    ) : (
                      <>
                        <Heart className="w-4 h-4" />
                        Confirm Donation
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={closeDonateModal}
                  className="w-full py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              )}

              {isEligible && selectedCamp && (
                <p className="text-center text-xs text-gray-500 mt-3">
                  1 unit of <strong>{donor?.bloodGroup}</strong> will be recorded for&nbsp;
                  <strong>{selectedCamp.title}</strong> and added to their blood inventory.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const MetricCard = ({ icon, label, value, subtitle, color, alert = false }) => {
  const colors = {
    blue:   { border: "border-l-blue-400",   bg: "bg-blue-100",   text: "text-blue-600" },
    green:  { border: "border-l-green-400",  bg: "bg-green-100",  text: "text-green-600" },
    red:    { border: "border-l-red-400",    bg: "bg-red-100",    text: "text-red-600" },
    purple: { border: "border-l-purple-400", bg: "bg-purple-100", text: "text-purple-600" },
  }[color] || { border: "border-l-blue-400", bg: "bg-blue-100", text: "text-blue-600" };

  return (
    <div className={`bg-white rounded-xl shadow-lg border-l-4 ${alert ? "border-l-red-400" : colors.border} p-5`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
          {subtitle && <p className={`text-xs ${alert ? "text-red-600" : "text-gray-500"} mt-1`}>{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${alert ? "bg-red-100 text-red-600" : `${colors.bg} ${colors.text}`}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, icon, subtitle, children, className = "" }) => (
  <div className={`bg-white rounded-2xl shadow-lg border border-red-50 p-6 ${className}`}>
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">{icon} {title}</h3>
      {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const LabInfo = ({ icon, label, value, truncate = false }) => (
  <div className="flex items-start gap-3">
    <div className="p-2 bg-red-100 rounded-lg text-red-600 mt-1">{icon}</div>
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`font-medium text-gray-800 ${truncate ? "truncate" : ""}`}>{value || "—"}</p>
    </div>
  </div>
);

const DonationHistoryItem = ({ donation }) => (
  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
    <div className="flex items-center gap-3">
      <div className="p-2 bg-red-100 rounded-lg text-red-600">
        <Droplet className="w-4 h-4" />
      </div>
      <div>
        <p className="font-medium text-gray-800">{donation.facility || "Blood Donation Camp"}</p>
        <p className="text-xs text-gray-500">
          {new Date(donation.donationDate || donation.date).toLocaleDateString()} • {donation.bloodType || donation.bloodGroup}
        </p>
      </div>
    </div>
    <div className="text-right">
      <span className="font-bold text-gray-800">{donation.quantity || 1} unit</span>
      <p className="text-xs text-green-600 mt-1">✓ Recorded</p>
    </div>
  </div>
);

const ActivityCard = ({ activity }) => (
  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
    <div className="flex-1">
      <h4 className="font-medium text-gray-800 mb-1">{activity.eventType || "Donation"}</h4>
      <p className="text-sm text-gray-600">{activity.description || "Blood donation completed"}</p>
    </div>
    <span className="text-xs text-gray-500 ml-4 flex-shrink-0">
      {new Date(activity.date || activity.donationDate || activity.createdAt).toLocaleDateString()}
    </span>
  </div>
);

const ActionCard = ({ icon, title, description, onClick, color = "blue", highlight = false }) => {
  const colors = {
    blue:   "bg-blue-50   text-blue-600   hover:bg-blue-100   border-blue-200",
    green:  "bg-green-50  text-green-600  hover:bg-green-100  border-green-200",
    red:    "bg-red-50    text-red-600    hover:bg-red-100    border-red-200",
    purple: "bg-purple-50 text-purple-600 hover:bg-purple-100 border-purple-200",
  }[color];

  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl border text-left transition-all ${colors} ${
        highlight ? "ring-2 ring-red-400 ring-offset-2 shadow-lg" : ""
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-white rounded-lg shadow-sm">{icon}</div>
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <p className="text-xs opacity-75">{description}</p>
    </button>
  );
};

const HealthStat = ({ label, value, icon }) => (
  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
    <div>
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="text-lg font-bold text-gray-800">{value}</p>
    </div>
    <div className="p-2 bg-red-100 rounded-lg text-red-600">{icon}</div>
  </div>
);

const EmptyState = ({ icon, message, actionText, onAction }) => (
  <div className="text-center py-8 text-gray-500">
    <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">{icon}</div>
    <p className="text-sm mb-3">{message}</p>
    {actionText && onAction && (
      <button
        onClick={onAction}
        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
      >
        {actionText}
      </button>
    )}
  </div>
);

export default DonorDashboard;