import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./Login";

const PLATFORM_META = {
  Facebook: { icon: "📘" },
  "Facebook Group": { icon: "👥" },
  Instagram: { icon: "📷" },
  YouTube: { icon: "▶️" },
  TikTok: { icon: "🎵" },
  LinkedIn: { icon: "💼" },
};

export default function App() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    );
  }

  if (!session) return <Login />;

  return <Broadcast user={session.user} />;
}

function Broadcast({ user }) {
  const [step, setStep] = useState(1);
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [newAcct, setNewAcct] = useState({ platform: "Facebook", name: "" });

  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [mediaMeta, setMediaMeta] = useState(null);
  const [caption, setCaption] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [hashtagTopic, setHashtagTopic] = useState("");
  const [hashtagSuggestions, setHashtagSuggestions] = useState([]);
  const [postedStatus, setPostedStatus] = useState({});

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setAccountsLoading(true);
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error && data) setAccounts(data);
    setAccountsLoading(false);
  };

  const addAccount = async () => {
    if (!newAcct.name.trim()) return;
    const { data, error } = await supabase
      .from("accounts")
      .insert({ platform: newAcct.platform, name: newAcct.name.trim(), owner_id: user.id })
      .select()
      .single();
    if (!error && data) {
      setAccounts([...accounts, data]);
      setNewAcct({ ...newAcct, name: "" });
    }
  };

  const removeAccount = async (id) => {
    setAccounts(accounts.filter((a) => a.id !== id));
    await supabase.from("accounts").delete().eq("id", id);
  };

  const VIDEO_EXTS = ["mp4", "mov", "m4v", "webm", "avi", "mkv"];
  const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"];

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setMediaMeta(null);
    const url = URL.createObjectURL(file);
    setFileUrl(url);

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const isVideo = file.type.startsWith("video/") || VIDEO_EXTS.includes(ext);
    const isImage = file.type.startsWith("image/") || IMAGE_EXTS.includes(ext);

    if (isVideo) {
      setMediaType("video");
      setMediaMeta({ sandboxLimited: true, size: file.size, type: file.type || ext });
    } else if (isImage) {
      setMediaType("image");
      const imgEl = new Image();
      imgEl.onload = () => setMediaMeta({ width: imgEl.width, height: imgEl.height });
      imgEl.onerror = () => setMediaMeta({ unreadable: true });
      imgEl.src = url;
    } else {
      setMediaType("unknown");
    }
  };

  const runAiReview = () => {
    const suggestions = [];

    if (mediaType === "video" && mediaMeta) {
      const sizeMb = (mediaMeta.size / (1024 * 1024)).toFixed(1);
      suggestions.push(
        `${fileName} (${sizeMb}MB) — resolution and duration checks happen server-side in a full build. Rule of thumb: vertical 9:16 and under 60s works best for TikTok/Reels/Shorts; landscape is fine for Facebook or LinkedIn.`
      );
    } else if (mediaType === "image" && mediaMeta && !mediaMeta.unreadable) {
      const { width, height } = mediaMeta;
      const ratio = width / height;
      suggestions.push(`Image is ${width}×${height}.`);
      suggestions.push(
        ratio > 1.91 || ratio < 0.5
          ? "This aspect ratio is quite extreme — some platforms will crop it in feed view. A closer-to-square or 4:5 crop is safer."
          : "This aspect ratio will display well on Facebook and Instagram feed posts."
      );
    } else if (mediaMeta && mediaMeta.unreadable) {
      suggestions.push(`Couldn't read ${fileName} in-browser — this file may need converting before posting.`);
    } else if (mediaType === "unknown" && fileName) {
      suggestions.push(`${fileName} isn't a recognized video or image type.`);
    }

    if (caption.length > 0 && caption.length < 40) {
      suggestions.push("Caption is short — LinkedIn audiences tend to engage more with 2-3 sentences of context.");
    }
    if (caption.length > 150) {
      suggestions.push("Caption is long — consider trimming for TikTok, where shorter captions perform better.");
    }
    if (caption.includes("#") || hashtagTopic.includes("#")) {
      // fine
    } else if (hashtagSuggestions.length > 0) {
      suggestions.push("You've generated hashtag suggestions but haven't added any to your caption yet.");
    } else {
      suggestions.push("No hashtags yet — Instagram and TikTok posts with 3-5 relevant hashtags typically get more reach.");
    }
    if (suggestions.length === 0) suggestions.push("Looks good — content and caption are ready to post.");
    setAiSuggestions(suggestions);
  };

  const generateHashtags = () => {
    const source = `${hashtagTopic} ${caption}`.toLowerCase();
    const words = source
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !["this", "that", "with", "from", "your", "have", "will"].includes(w));
    const uniqueWords = [...new Set(words)].slice(0, 5);
    const topicTags = uniqueWords.map((w) => `#${w}`);
    const genericTags = ["#smallbusiness", "#shopLocal", "#newpost", "#dealoftheday", "#supportlocal"];
    setHashtagSuggestions([...topicTags, ...genericTags.slice(0, 5 - topicTags.length)]);
  };

  const addHashtag = (tag) => {
    if (caption.includes(tag)) return;
    setCaption((prev) => (prev.trim() ? `${prev.trim()} ${tag}` : tag));
  };

  const markPosted = (id) => {
    setPostedStatus((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const grouped = accounts.reduce((acc, a) => {
    acc[a.platform] = acc[a.platform] || [];
    acc[a.platform].push(a);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-semibold text-neutral-900">Broadcast</h1>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs text-neutral-400 hover:text-neutral-700"
          >
            Sign out ({user.email})
          </button>
        </div>
        <p className="text-sm text-neutral-500 mb-6">Prep your content once, then track it as you post it everywhere.</p>

        <div className="flex gap-2 mb-8">
          {["Accounts", "Compose", "Checklist"].map((label, i) => (
            <button
              key={label}
              onClick={() => setStep(i + 1)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                step === i + 1
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300"
              }`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Your connected channels</h2>
            <p className="text-xs text-neutral-400 mb-4">
              These are only visible to you — each teammate manages their own channel list.
            </p>

            {accountsLoading && <p className="text-sm text-neutral-400 mb-4">Loading...</p>}
            {!accountsLoading && Object.keys(grouped).length === 0 && (
              <p className="text-sm text-neutral-400 mb-4">No channels yet. Add your pages and channels below.</p>
            )}

            {Object.entries(grouped).map(([platform, accts]) => (
              <div key={platform} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span>{PLATFORM_META[platform]?.icon}</span>
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{platform}</span>
                </div>
                <div className="space-y-2">
                  {accts.map((a) => (
                    <div key={a.id} className="flex items-center justify-between bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2">
                      <span className="text-sm text-neutral-800">{a.name}</span>
                      <button onClick={() => removeAccount(a.id)} className="text-xs text-neutral-400 hover:text-red-500">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="border-t border-neutral-200 pt-4 mt-4 flex gap-2">
              <select
                value={newAcct.platform}
                onChange={(e) => setNewAcct({ ...newAcct, platform: e.target.value })}
                className="border border-neutral-200 rounded-lg px-2 py-2 text-sm bg-white"
              >
                {Object.keys(PLATFORM_META).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <input
                value={newAcct.name}
                onChange={(e) => setNewAcct({ ...newAcct, name: e.target.value })}
                placeholder="Page or channel name"
                className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-sm"
              />
              <button onClick={addAccount} className="bg-neutral-900 text-white text-sm px-4 py-2 rounded-lg">
                Add
              </button>
            </div>

            <button onClick={() => setStep(2)} className="mt-6 w-full bg-neutral-900 text-white text-sm font-medium py-2.5 rounded-lg">
              Continue to compose
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-neutral-900 mb-4">Upload content</h2>

            <label className="block border-2 border-dashed border-neutral-200 rounded-lg p-6 text-center cursor-pointer mb-4 hover:border-neutral-300">
              <input type="file" accept="video/*,image/*" className="hidden" onChange={handleFileSelect} />
              {!fileName && <p className="text-sm text-neutral-500">Click to select a video or image</p>}
              {fileName && mediaType === "video" && (
                <div className="py-4">
                  <div className="text-3xl mb-2">🎬</div>
                  <p className="text-sm text-neutral-700 font-medium">{fileName}</p>
                  {mediaMeta && <p className="text-xs text-neutral-400 mt-1">{(mediaMeta.size / (1024 * 1024)).toFixed(1)}MB</p>}
                </div>
              )}
              {fileName && mediaType === "image" && (
                <>
                  <img src={fileUrl} alt={fileName} className="max-h-64 mx-auto rounded-lg mb-2" />
                  <p className="text-xs text-neutral-500 mt-1">
                    {fileName}
                    {mediaMeta && !mediaMeta.unreadable && ` — ${mediaMeta.width}×${mediaMeta.height}`}
                    {mediaMeta && mediaMeta.unreadable && " — preview unavailable"}
                    {!mediaMeta && " — reading file..."}
                  </p>
                </>
              )}
            </label>

            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your caption or ad copy..."
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm mb-4 h-24 resize-none"
            />

            <div className="border border-neutral-200 rounded-lg p-3 mb-4">
              <p className="text-xs font-medium text-neutral-500 mb-2">Hashtag suggestions</p>
              <div className="flex gap-2 mb-2">
                <input
                  value={hashtagTopic}
                  onChange={(e) => setHashtagTopic(e.target.value)}
                  placeholder="What's this post about?"
                  className="flex-1 border border-neutral-200 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={generateHashtags}
                  disabled={!hashtagTopic && !caption}
                  className="border border-neutral-300 text-neutral-700 text-sm font-medium px-3 py-2 rounded-lg disabled:opacity-40"
                >
                  Suggest
                </button>
              </div>
              {hashtagSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {hashtagSuggestions.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => addHashtag(tag)}
                      disabled={caption.includes(tag)}
                      className={`text-xs px-2.5 py-1 rounded-full border ${
                        caption.includes(tag)
                          ? "bg-neutral-100 text-neutral-400 border-neutral-200"
                          : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                      }`}
                    >
                      {tag}{caption.includes(tag) ? " ✓" : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={runAiReview}
              disabled={!fileName && !caption}
              className="w-full border border-neutral-300 text-neutral-700 text-sm font-medium py-2.5 rounded-lg mb-4 disabled:opacity-40"
            >
              Get AI suggestions
            </button>

            {aiSuggestions.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 space-y-1.5">
                {aiSuggestions.map((s, i) => (
                  <p key={i} className="text-xs text-amber-900">• {s}</p>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 border border-neutral-200 text-neutral-600 text-sm py-2.5 rounded-lg">
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!fileName && !caption}
                className="flex-1 bg-neutral-900 text-white text-sm font-medium py-2.5 rounded-lg disabled:opacity-40"
              >
                Go to posting checklist
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-neutral-900 mb-1">Post it, then check it off</h2>
            <p className="text-xs text-neutral-400 mb-4">Open each platform, post the content, then mark it here.</p>

            <div className="space-y-2 mb-2">
              {accounts.map((a) => {
                const isPosted = !!postedStatus[a.id];
                return (
                  <div
                    key={a.id}
                    className={`flex items-center justify-between border rounded-lg px-3 py-2.5 ${
                      isPosted ? "border-green-200 bg-green-50" : "border-neutral-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{PLATFORM_META[a.platform]?.icon}</span>
                      <span className={`text-sm ${isPosted ? "text-green-800 line-through" : "text-neutral-800"}`}>
                        {a.platform} — {a.name}
                      </span>
                    </div>
                    <button
                      onClick={() => markPosted(a.id)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${
                        isPosted ? "border-green-300 bg-white text-green-700" : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      {isPosted ? "✓ Posted" : "Mark as posted"}
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-neutral-400 mb-6">
              {Object.values(postedStatus).filter(Boolean).length} of {accounts.length} channels posted
            </p>

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="flex-1 border border-neutral-200 text-neutral-600 text-sm py-2.5 rounded-lg">
                Back
              </button>
              <button onClick={() => setPostedStatus({})} className="flex-1 border border-neutral-200 text-neutral-600 text-sm py-2.5 rounded-lg">
                Reset for next post
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
