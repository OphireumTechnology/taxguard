import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { JobPosting } from '../../types';
import { 
  Briefcase, 
  MapPin, 
  Clock, 
  DollarSign, 
  Search, 
  Building2, 
  Check, 
  ArrowRight, 
  UploadCloud, 
  CheckCircle2, 
  X,
  FileText,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export const CareersPage: React.FC = () => {
  const { jobPostings, setCurrentPage, setSelectedJob, applyForJob, isLoadingData, dataError, refreshBackendData } = useApp();
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [applyingJob, setApplyingJob] = useState<JobPosting | null>(null);

  // Application Modal state
  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [resumeName, setResumeName] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [submittedAppId, setSubmittedAppId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Defensive array handling & filter open/active jobs
  const allJobs = Array.isArray(jobPostings) ? jobPostings : [];
  const activeJobs = useMemo(() => {
    return allJobs.filter((job) => job && job.status === 'open' && job.isActive !== false);
  }, [allJobs]);

  // Dynamically compute department filters from active listings
  const departments = useMemo(() => {
    const deptSet = new Set<string>(['All']);
    activeJobs.forEach((job) => {
      if (job.department) deptSet.add(job.department);
    });
    return Array.from(deptSet);
  }, [activeJobs]);

  const filteredJobs = useMemo(() => {
    return activeJobs.filter((job) => {
      const matchesDept = selectedDept === 'All' || job.department === selectedDept;
      const searchLower = (search || '').trim().toLowerCase();
      const matchesSearch = !searchLower || 
        (job.title || '').toLowerCase().includes(searchLower) || 
        (job.description || '').toLowerCase().includes(searchLower) ||
        (job.department || '').toLowerCase().includes(searchLower);
      return matchesDept && matchesSearch;
    });
  }, [activeJobs, selectedDept, search]);

  const handleOpenApply = (job: JobPosting) => {
    setApplyingJob(job);
    setSubmittedAppId(null);
    setSubmitError(null);
    setApplicantName('');
    setApplicantEmail('');
    setApplicantPhone('');
    setResumeName('');
    setCoverLetter('');
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingJob) return;

    setSubmitError(null);
    const trimmedName = applicantName.trim();
    const trimmedEmail = applicantEmail.trim();
    const trimmedPhone = applicantPhone.trim();

    if (trimmedName.length < 2) {
      setSubmitError('Please enter your full legal name (minimum 2 characters).');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setSubmitError('Please provide a valid email address (e.g. name@domain.com).');
      return;
    }

    const digitsOnly = trimmedPhone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      setSubmitError('Please provide a valid phone number with at least 10 digits.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await applyForJob({
        jobId: applyingJob.id,
        jobTitle: applyingJob.title,
        fullName: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        resumeFileName: resumeName || 'Candidate_Resume.pdf',
        coverLetter: coverLetter.trim(),
      });

      if (result.success && result.applicantId) {
        setSubmittedAppId(result.applicantId);
      } else {
        setSubmitError(result.error || 'Failed to submit application. Please check your submission.');
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'A network error occurred while submitting. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-16 pb-20 text-slate-100">
      
      {/* Header Banner */}
      <section className="relative pt-12 pb-14 border-b border-[#1E3A5F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0D2340] border border-[#C6A15B]/40 text-[#C6A15B] text-xs font-semibold">
            <Briefcase className="w-3.5 h-3.5" />
            <span>Join Our Mission</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-extrabold text-white">
            Careers at A/R Tax Services, LLC
          </h1>
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Build a rewarding career empowering individuals and businesses. Join our collaborative, 
            high-integrity accounting and tax advisory team in Columbia, South Carolina and remote.
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto pt-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search open positions by title or keyword..."
                className="w-full bg-[#0D2340] border border-[#1E3A5F] focus:border-[#C6A15B] rounded-xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-400 focus:outline-none shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Firm Culture & Benefits Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { title: 'Continuous CPE Learning', desc: 'Full reimbursement for professional licenses, EA certifications, and CPA credits.' },
            { title: 'Year-Round Balance', desc: 'Sustainable pacing with flexible summer hours and hybrid remote options.' },
            { title: 'Generous Compensation', desc: 'Competitive base salaries plus bi-annual performance and bonus incentives.' },
            { title: 'Impactful Mission', desc: 'Work directly with clients who genuinely appreciate your advocacy and guidance.' },
          ].map((b, i) => (
            <div key={i} className="p-6 rounded-2xl bg-[#0D2340] border border-[#1E3A5F] space-y-2">
              <div className="text-xs font-bold text-[#C6A15B] uppercase tracking-wider">{b.title}</div>
              <p className="text-xs text-slate-300 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Job Listings Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#1E3A5F] pb-4">
          <div>
            <h2 className="font-serif text-2xl font-bold text-white">Current Opportunities</h2>
            <p className="text-xs text-slate-400 mt-0.5">Explore open roles across our advisory practice.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedDept === dept
                    ? 'bg-[#C6A15B] text-[#07172B] font-bold'
                    : 'bg-[#0D2340] text-slate-300 hover:text-white border border-[#1E3A5F]'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {filteredJobs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs bg-[#0D2340] rounded-2xl border border-[#1E3A5F]">
              No positions currently match your search criteria. You may still submit a general inquiry to info@artaxservices.com.
            </div>
          ) : (
            filteredJobs.map((job) => (
              <div 
                key={job.id}
                className="p-7 rounded-2xl bg-[#0D2340] border border-[#1E3A5F] hover:border-[#C6A15B]/60 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-3 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#07172B] text-[#C6A15B] border border-[#1E3A5F] font-semibold">
                      {job.department}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#07172B] text-slate-300 border border-[#1E3A5F]">
                      {job.type}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {job.workplace}
                    </span>
                  </div>

                  <h3 className="font-serif text-2xl font-bold text-white">{job.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{job.description}</p>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#C6A15B]" />
                      <span>{job.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-[#C6A15B]" />
                      <span>{job.salaryRange}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-row md:flex-col items-center gap-3">
                  <button
                    onClick={() => {
                      setSelectedJob(job);
                      setCurrentPage('job_detail');
                    }}
                    className="w-full md:w-40 py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-[#07172B] hover:text-white border border-[#1E3A5F] hover:border-[#C6A15B]"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handleOpenApply(job)}
                    className="w-full md:w-40 py-2.5 rounded-xl text-xs font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] shadow-md"
                  >
                    Apply Now
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Application Modal */}
      {applyingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0D2340] border border-[#C6A15B]/50 rounded-2xl max-w-lg w-full p-6 sm:p-8 text-slate-100 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            
            <button
              onClick={() => setApplyingJob(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#132E52]"
            >
              <X className="w-5 h-5" />
            </button>

            {!submittedAppId ? (
              <form onSubmit={handleApplySubmit} className="space-y-4">
                <div className="border-b border-[#1E3A5F] pb-3">
                  <span className="text-[11px] font-bold text-[#C6A15B] uppercase tracking-wider">
                    Application Form
                  </span>
                  <h3 className="font-serif text-xl font-bold text-white mt-1">
                    Apply for: {applyingJob.title}
                  </h3>
                  <div className="text-xs text-slate-400">{applyingJob.department} • {applyingJob.location}</div>
                </div>

                {submitError && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400 mt-0.5" />
                    <span className="leading-relaxed">{submitError}</span>
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Full Legal Name *</label>
                    <input
                      type="text"
                      required
                      value={applicantName}
                      onChange={(e) => setApplicantName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                      className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={applicantEmail}
                      onChange={(e) => setApplicantEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={applicantPhone}
                      onChange={(e) => setApplicantPhone(e.target.value)}
                      placeholder="803-555-0199"
                      className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Resume / CV Document *</label>
                    <div className="p-4 border-2 border-dashed border-[#1E3A5F] rounded-xl text-center bg-[#07172B] hover:border-[#C6A15B] transition-colors cursor-pointer relative">
                      <input 
                        type="file" 
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            if (file.size > 10 * 1024 * 1024) {
                              setSubmitError('Resume file size must not exceed 10MB.');
                              return;
                            }
                            setResumeName(file.name);
                            setSubmitError(null);
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <UploadCloud className="w-6 h-6 text-[#C6A15B] mx-auto mb-1" />
                      <div className="text-xs font-semibold text-slate-200">
                        {resumeName ? resumeName : 'Upload Resume (PDF, DOCX)'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Drag and drop or browse files (Max 10MB)</div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Brief Cover Note</label>
                    <textarea
                      rows={3}
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      placeholder="Share a brief overview of your tax/accounting background and why you wish to join A/R Tax Services..."
                      className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg p-3 text-white focus:outline-none focus:border-[#C6A15B]"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting Application...' : 'Submit Job Application'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-white">Application Received!</h3>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Thank you, <strong className="text-white">{applicantName}</strong>. Your application for <strong className="text-white">{applyingJob.title}</strong> has been logged in our recruitment vault.
                </p>
                <div className="p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-xs text-[#C6A15B] font-mono">
                  Application ID: {submittedAppId}
                </div>
                <button
                  onClick={() => setApplyingJob(null)}
                  className="w-full py-2.5 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A]"
                >
                  Close Window
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
