import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Briefcase, 
  MapPin, 
  DollarSign, 
  Check, 
  ArrowLeft, 
  Calendar, 
  ShieldCheck, 
  UploadCloud, 
  CheckCircle2, 
  X,
  AlertCircle 
} from 'lucide-react';

export const JobDetailPage: React.FC = () => {
  const { selectedJob, setCurrentPage, applyForJob } = useApp();

  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [resumeName, setResumeName] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [submittedAppId, setSubmittedAppId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!selectedJob) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4 text-slate-100">
        <p className="text-sm text-slate-400">No job listing currently selected.</p>
        <button
          onClick={() => setCurrentPage('careers')}
          className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#07172B] bg-[#C6A15B]"
        >
          Return to Careers
        </button>
      </div>
    );
  }

  const isPositionOpen = selectedJob.status === 'open' && selectedJob.isActive !== false;

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setSubmitError('Please provide a valid email address.');
      return;
    }

    const digitsOnly = trimmedPhone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      setSubmitError('Please provide a valid 10-digit phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await applyForJob({
        jobId: selectedJob.id,
        jobTitle: selectedJob.title,
        fullName: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        resumeFileName: resumeName || 'Candidate_Resume.pdf',
        coverLetter: coverLetter.trim(),
      });

      if (result.success && result.applicantId) {
        setSubmittedAppId(result.applicantId);
      } else {
        setSubmitError(result.error || 'Failed to submit application.');
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'A network error occurred while submitting.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-12 pb-20 text-slate-100">
      
      {/* Back button & Title */}
      <section className="pt-10 max-w-4xl mx-auto px-4 sm:px-6">
        <button
          onClick={() => setCurrentPage('careers')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#C6A15B] hover:text-[#D9BF7A] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to All Positions
        </button>

        <div className="p-8 sm:p-10 rounded-3xl bg-[#0D2340] border border-[#1E3A5F] shadow-2xl space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="px-3 py-0.5 rounded-full bg-[#07172B] text-[#C6A15B] border border-[#1E3A5F] font-bold">
                {selectedJob.department}
              </span>
              <span className="px-3 py-0.5 rounded-full bg-[#07172B] text-slate-300 border border-[#1E3A5F]">
                {selectedJob.type}
              </span>
              <span className="px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {selectedJob.workplace}
              </span>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl font-extrabold text-white">
              {selectedJob.title}
            </h1>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300 pt-2 border-t border-[#1E3A5F]">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#C6A15B]" />
                <span>{selectedJob.location}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-[#C6A15B]" />
                <span>{selectedJob.salaryRange}</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            {isPositionOpen ? (
              <button
                onClick={() => {
                  setSubmitError(null);
                  setIsModalOpen(true);
                }}
                className="px-8 py-3.5 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all shadow-xl"
              >
                Apply for This Position
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                <AlertCircle className="w-4 h-4" />
                <span>This position is currently closed and no longer accepting applications.</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Description, Responsibilities & Requirements */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
        {/* Overview */}
        <div className="p-8 rounded-3xl bg-[#0D2340]/70 border border-[#1E3A5F] space-y-4">
          <h2 className="font-serif text-xl font-bold text-white">About the Role</h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {selectedJob.description}
          </p>
        </div>

        {/* Responsibilities */}
        <div className="p-8 rounded-3xl bg-[#0D2340]/70 border border-[#1E3A5F] space-y-4">
          <h2 className="font-serif text-xl font-bold text-white">Key Responsibilities</h2>
          <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
            {selectedJob.responsibilities.map((r, i) => (
              <li key={i} className="flex items-start gap-3">
                <Check className="w-4 h-4 text-[#C6A15B] flex-shrink-0 mt-0.5" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Requirements */}
        <div className="p-8 rounded-3xl bg-[#0D2340]/70 border border-[#1E3A5F] space-y-4">
          <h2 className="font-serif text-xl font-bold text-white">Qualifications & Requirements</h2>
          <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
            {selectedJob.requirements.map((req, i) => (
              <li key={i} className="flex items-start gap-3">
                <Check className="w-4 h-4 text-[#C6A15B] flex-shrink-0 mt-0.5" />
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom Apply CTA */}
        <div className="p-8 rounded-3xl bg-[#07172B] border border-[#C6A15B]/30 flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg font-bold text-white">Ready to take the next step?</h3>
            <p className="text-xs text-slate-400 mt-0.5">Submit your credentials directly to Desmond Hinds and our hiring team.</p>
          </div>
          {isPositionOpen ? (
            <button
              onClick={() => {
                setSubmitError(null);
                setIsModalOpen(true);
              }}
              className="px-6 py-3 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A]"
            >
              Apply Now
            </button>
          ) : (
            <span className="text-xs text-amber-400 font-semibold px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              Closed
            </span>
          )}
        </div>
      </section>

      {/* Application Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0D2340] border border-[#C6A15B]/50 rounded-2xl max-w-lg w-full p-6 sm:p-8 text-slate-100 shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {!submittedAppId ? (
              <form onSubmit={handleApplySubmit} className="space-y-4">
                <div className="border-b border-[#1E3A5F] pb-3">
                  <h3 className="font-serif text-xl font-bold text-white">
                    Apply: {selectedJob.title}
                  </h3>
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
                      placeholder="Jane Doe"
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
                      placeholder="jane@example.com"
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
                      placeholder="803-555-0123"
                      className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Resume File</label>
                    <div className="p-3 border-2 border-dashed border-[#1E3A5F] rounded-xl text-center bg-[#07172B]">
                      <input 
                        type="file" 
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setResumeName(e.target.files[0].name);
                          }
                        }}
                        className="w-full text-xs text-slate-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Cover Note (Optional)</label>
                    <textarea
                      rows={3}
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      placeholder="Brief note to the hiring director..."
                      className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg p-3 text-white focus:outline-none focus:border-[#C6A15B]"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="font-serif text-xl font-bold text-white">Application Successfully Submitted</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  We have received your application for {selectedJob.title}. Our team will review your qualifications and contact you.
                </p>
                <div className="text-xs font-mono text-[#C6A15B]">Tracking ID: {submittedAppId}</div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-full py-2.5 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B]"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
