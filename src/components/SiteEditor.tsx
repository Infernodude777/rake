import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor, Smartphone, Check, Eye, EyeOff,
  Palette, Layout, Type, Image, Download, Code, Loader2,
  Circle, Square, Triangle, Type as TypeIcon, Trash2, Undo, ZoomIn, ZoomOut,
} from 'lucide-react';
import * as fabric from 'fabric';
import type { GeneratedSite } from '../types';
import { useData } from '../context/DataContext';
import { generateFullWebsiteHTML } from '../services/llm';

interface SiteEditorProps {
  open: boolean;
  site: GeneratedSite | null;
  onClose: () => void;
  onPublish: () => void;
}

// ── Image Creator Modal using Fabric.js ──

function ImageCreatorModal({
  open,
  onClose,
  onSave,
  accentColor,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (imageDataUrl: string) => void;
  accentColor: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'rect' | 'circle' | 'triangle' | 'text'>('select');
  const [zoom, setZoom] = useState(1);

  // Cleanup fabric canvas on unmount
  useEffect(() => {
    return () => {
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (open && canvasRef.current && !fabricRef.current) {
      fabricRef.current = new fabric.Canvas(canvasRef.current, {
        width: 600,
        height: 400,
        backgroundColor: '#ffffff',
      });
    } else if (!open && fabricRef.current) {
      fabricRef.current.dispose();
      fabricRef.current = null;
    }
  }, [open]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!fabricRef.current || !canvasRef.current) return;
    const canvas = fabricRef.current;
    const rect = canvasRef.current.getBoundingClientRect();
    const pointer = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    if (activeTool === 'rect') {
      const rect = new fabric.Rect({
        left: pointer.x,
        top: pointer.y,
        width: 120,
        height: 80,
        fill: accentColor + '40',
        stroke: accentColor,
        strokeWidth: 2,
        rx: 8,
        ry: 8,
      });
      canvas.add(rect);
      canvas.setActiveObject(rect);
      canvas.renderAll();
    } else if (activeTool === 'circle') {
      const circle = new fabric.Circle({
        left: pointer.x,
        top: pointer.y,
        radius: 50,
        fill: accentColor + '30',
        stroke: accentColor,
        strokeWidth: 2,
      });
      canvas.add(circle);
      canvas.setActiveObject(circle);
      canvas.renderAll();
    } else if (activeTool === 'triangle') {
      const triangle = new fabric.Triangle({
        left: pointer.x,
        top: pointer.y,
        width: 100,
        height: 100,
        fill: accentColor + '30',
        stroke: accentColor,
        strokeWidth: 2,
      });
      canvas.add(triangle);
      canvas.setActiveObject(triangle);
      canvas.renderAll();
    } else if (activeTool === 'text') {
      const text = new fabric.IText('Click to edit', {
        left: pointer.x,
        top: pointer.y,
        fontSize: 24,
        fill: accentColor,
        fontFamily: 'Inter, sans-serif',
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      canvas.renderAll();
    }
  };

  const handleDelete = () => {
    if (!fabricRef.current) return;
    const active = fabricRef.current.getActiveObject();
    if (active) {
      fabricRef.current.remove(active);
      fabricRef.current.renderAll();
    }
  };

  const handleUndo = () => {
    if (!fabricRef.current) return;
    const objects = fabricRef.current.getObjects();
    if (objects.length > 0) {
      fabricRef.current.remove(objects[objects.length - 1]);
      fabricRef.current.renderAll();
    }
  };

  const handleZoomIn = () => {
    if (!fabricRef.current) return;
    const newZoom = Math.min(zoom + 0.2, 3);
    setZoom(newZoom);
    fabricRef.current.setZoom(newZoom);
    fabricRef.current.renderAll();
  };

  const handleZoomOut = () => {
    if (!fabricRef.current) return;
    const newZoom = Math.max(zoom - 0.2, 0.5);
    setZoom(newZoom);
    fabricRef.current.setZoom(newZoom);
    fabricRef.current.renderAll();
  };

  const handleSaveImage = () => {
    if (!fabricRef.current) return;
    const dataUrl = fabricRef.current.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
    });
    onSave(dataUrl);
    onClose();
  };

  const handleClear = () => {
    if (!fabricRef.current) return;
    fabricRef.current.clear();
    fabricRef.current.backgroundColor = '#ffffff';
    fabricRef.current.renderAll();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-6" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Image Creator</h3>
          <div className="flex items-center gap-2">
            <button onClick={handleClear} className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors text-xs flex items-center gap-2">
              <Trash2 size={14} /> Clear
            </button>
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button onClick={handleSaveImage} className="px-4 py-2 rounded-lg bg-white text-black font-medium hover:bg-zinc-200 transition-colors">
              Save Image
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-zinc-800 flex items-center gap-4">
          <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
            {[
              { id: 'select', icon: Monitor, label: 'Select' },
              { id: 'rect', icon: Square, label: 'Rectangle' },
              { id: 'circle', icon: Circle, label: 'Circle' },
              { id: 'triangle', icon: Triangle, label: 'Triangle' },
              { id: 'text', icon: TypeIcon, label: 'Text' },
            ].map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id as any)}
                className={`p-2 rounded-md transition-colors ${
                  activeTool === tool.id
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-500 hover:text-white'
                }`}
                title={tool.label}
              >
                <tool.icon size={18} />
              </button>
            ))}
          </div>
          <div className="h-6 w-px bg-zinc-700" />
          <button onClick={handleUndo} className="p-2 rounded-lg text-zinc-500 hover:text-white transition-colors" title="Undo">
            <Undo size={18} />
          </button>
          <button onClick={handleDelete} className="p-2 rounded-lg text-zinc-500 hover:text-red-400 transition-colors" title="Delete">
            <Trash2 size={18} />
          </button>
          <div className="h-6 w-px bg-zinc-700" />
          <button onClick={handleZoomOut} className="p-2 rounded-lg text-zinc-500 hover:text-white transition-colors" title="Zoom Out">
            <ZoomOut size={18} />
          </button>
          <span className="text-xs text-zinc-500 font-mono">{Math.round(zoom * 100)}%</span>
          <button onClick={handleZoomIn} className="p-2 rounded-lg text-zinc-500 hover:text-white transition-colors" title="Zoom In">
            <ZoomIn size={18} />
          </button>
        </div>

        {/* Canvas area */}
        <div
          className="p-6 bg-zinc-950 flex items-center justify-center overflow-auto"
          onClick={handleCanvasClick}
          style={{ cursor: activeTool === 'select' ? 'default' : 'crosshair' }}
        >
          <div className="relative" style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-zinc-800 text-xs text-zinc-500">
          Click on the canvas to add shapes. Drag to move, resize handles to scale, rotation handle to rotate.
        </div>
      </motion.div>
    </div>
  );
}

// ── Template style definitions ──

const TEMPLATES: Record<string, {
  fontFamily: string;
  headingFont: string;
  heroBg: string;
  heroText: string;
  sectionBg: string;
  sectionText: string;
  accent: string;
  cardBg: string;
  border: string;
  buttonBg: string;
  buttonText: string;
  footerBg: string;
  footerText: string;
  heroPattern?: string;
  headingWeight: string;
  bodyWeight: string;
  borderRadius: string;
}> = {
  Luxury: {
    fontFamily: "'Georgia', 'Times New Roman', serif",
    headingFont: "'Georgia', serif",
    headingWeight: '700',
    bodyWeight: '400',
    heroBg: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    heroText: '#f5f0e8',
    sectionBg: '#faf6f0',
    sectionText: '#2d2d2d',
    accent: '#c9a84c',
    cardBg: '#ffffff',
    border: '#e8dcc8',
    buttonBg: '#c9a84c',
    buttonText: '#1a1a2e',
    footerBg: '#1a1a2e',
    footerText: '#f5f0e8',
    heroPattern: 'url("data:image/svg+xml,%3Csvg width=60 height=60 viewBox=0 0 60 60 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.03%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
    borderRadius: '8px',
  },
  Modern: {
    fontFamily: "'Inter', 'system-ui', sans-serif",
    headingFont: "'Inter', sans-serif",
    headingWeight: '800',
    bodyWeight: '400',
    heroBg: 'linear-gradient(135deg, #0f0f13 0%, #1a1a2e 50%, #2d1b69 100%)',
    heroText: '#ffffff',
    sectionBg: '#0f0f13',
    sectionText: '#e4e4e7',
    accent: '#7c3aed',
    cardBg: '#18181b',
    border: '#27272a',
    buttonBg: '#7c3aed',
    buttonText: '#ffffff',
    footerBg: '#09090b',
    footerText: '#a1a1aa',
    borderRadius: '16px',
  },
  Minimal: {
    fontFamily: "'Inter', 'system-ui', sans-serif",
    headingFont: "'Inter', sans-serif",
    headingWeight: '600',
    bodyWeight: '400',
    heroBg: '#ffffff',
    heroText: '#111111',
    sectionBg: '#fafafa',
    sectionText: '#333333',
    accent: '#2563eb',
    cardBg: '#ffffff',
    border: '#e5e7eb',
    buttonBg: '#111111',
    buttonText: '#ffffff',
    footerBg: '#111111',
    footerText: '#a1a1aa',
    borderRadius: '4px',
  },
};

const SECTION_META: { id: string; label: string; icon: typeof Layout }[] = [
  { id: 'about', label: 'About', icon: Type },
  { id: 'services', label: 'Services', icon: Layout },
  { id: 'gallery', label: 'Gallery', icon: Image },
  { id: 'contact', label: 'Contact', icon: Type },
];

// ── Inline editable text field ──

function EditableField({
  value,
  onChange,
  className,
  style,
  as = 'span',
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p';
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleSave = () => {
    onChange(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="relative group" style={style}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') { setDraft(value); setEditing(false); }
          }}
          className={`bg-white/10 border border-white/30 rounded px-2 py-1 w-full outline-none focus:border-white/60 transition-colors ${className || ''}`}
          autoFocus
        />
        <button
          onClick={handleSave}
          className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Check size={8} className="text-white" />
        </button>
      </div>
    );
  }

  const Tag = as;
  return (
    <Tag
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`cursor-pointer hover:ring-1 hover:ring-white/20 rounded transition-all ${className || ''}`}
      style={style}
      title="Click to edit"
    >
      {value || 'Click to add text'}
    </Tag>
  );
}

// ── Main Component ──

export default function SiteEditor({ open, site, onClose, onPublish }: SiteEditorProps) {
  const { addNotification, apiKeys } = useData();
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'content' | 'theme' | 'sections' | 'gallery'>('content');
  const [copied, setCopied] = useState(false);
  const [generatingHtml, setGeneratingHtml] = useState(false);
  const [fullHtml, setFullHtml] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [showImageCreator, setShowImageCreator] = useState(false);
  const [customImages, setCustomImages] = useState<string[]>([]);

  // Editable site state
  const [editableSite, setEditableSite] = useState<GeneratedSite | null>(null);

  // Reset edits when a different site is opened
  useEffect(() => {
    setEditableSite(null);
  }, [site?.id]);

  // Use editable copy if available, otherwise fall back to the site prop
  const currentSite = site && editableSite?.id === site.id ? editableSite : site;

  if (!currentSite) return null;

  const updateSite = (updates: Partial<GeneratedSite>) => {
    if (!editableSite) {
      setEditableSite({ ...currentSite, ...updates });
    } else {
      setEditableSite({ ...editableSite, ...updates });
    }
  };

  const toggleSection = (sectionId: string) => {
    const current = (editableSite || currentSite);
    const vis = current.visibleSections.includes(sectionId)
      ? current.visibleSections.filter((s) => s !== sectionId)
      : [...current.visibleSections, sectionId];
    updateSite({ visibleSections: vis });
  };

  const template = TEMPLATES[currentSite.variant] || TEMPLATES.Modern;

  // ── Preview styles ──
  const previewStyle: React.CSSProperties = {
    fontFamily: template.fontFamily,
    color: template.sectionText,
    backgroundColor: template.sectionBg,
    borderRadius: template.borderRadius,
  };

  const heroStyle: React.CSSProperties = {
    backgroundImage: template.heroBg,
    backgroundSize: 'cover',
    color: template.heroText,
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: template.cardBg,
    border: `1px solid ${template.border}`,
    borderRadius: template.borderRadius,
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: template.buttonBg,
    color: template.buttonText,
    borderRadius: template.borderRadius,
    fontWeight: 600,
  };

  const footerStyle: React.CSSProperties = {
    backgroundColor: template.footerBg,
    color: template.footerText,
  };

  const accentStyle: React.CSSProperties = {
    color: template.accent,
  };

  const handleSaveCustomImage = (imageDataUrl: string) => {
    setCustomImages((prev) => [...prev, imageDataUrl]);
    addNotification('Image created and saved! 📸');
  };

  // ── Generate & Download Full Website HTML ──
  const handleGenerateFullHtml = async () => {
    if (!currentSite) return;
    setGeneratingHtml(true);
    try {
      const html = await generateFullWebsiteHTML(apiKeys, {
        name: currentSite.business,
        category: currentSite.name.split('•')[1]?.trim() || 'Business',
        location: currentSite.contactAddress,
        hero: currentSite.hero,
        tagline: currentSite.tagline,
        aboutTitle: currentSite.aboutTitle,
        aboutText: currentSite.aboutText,
        servicesTitle: currentSite.servicesTitle,
        services: currentSite.services,
        galleryTitle: currentSite.galleryTitle,
        contactTitle: currentSite.contactTitle,
        contactEmail: currentSite.contactEmail,
        contactPhone: currentSite.contactPhone,
        contactAddress: currentSite.contactAddress,
        primaryColor: currentSite.primaryColor,
        secondaryColor: currentSite.secondaryColor,
        accentColor: currentSite.accentColor,
        visibleSections: currentSite.visibleSections,
        metaDescription: currentSite.metaDescription || '',
        metaKeywords: currentSite.metaKeywords || '',
        variant: currentSite.variant,
      });
      setFullHtml(html);
      if (html) {
        // Auto-download
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentSite.business.toLowerCase().replace(/[^a-z0-9]/g, '-')}.html`;
        a.click();
        URL.revokeObjectURL(url);
        addNotification('Full website HTML generated & downloaded! 🚀');
      }
    } catch (e: any) {
      addNotification(`HTML generation failed: ${e.message}. Using preview HTML instead.`);
      // Fallback: copy inner HTML
      handleCopyHtml();
    } finally {
      setGeneratingHtml(false);
    }
  };

  // ── Copy HTML handler (fallback / quick copy) ──
  const handleCopyHtml = () => {
    const previewEl = document.getElementById('site-preview-content');
    if (previewEl) {
      const html = previewEl.innerHTML;
      navigator.clipboard.writeText(html).then(() => {
        setCopied(true);
        addNotification('Site HTML copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  // ── Check if a section is visible ──
  const isVisible = (id: string) => {
    return currentSite.visibleSections.includes(id);
  };

  // ── Render the website preview ──
  const renderPreview = () => (
    <div
      id="site-preview-content"
      style={{
        ...previewStyle,
        maxWidth: previewMode === 'mobile' ? 375 : '100%',
        margin: '0 auto',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
      }}
    >
      {/* ── Hero Section ── */}
      <section style={{ ...heroStyle, padding: '80px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden', minHeight: 400 }}>
        {template.heroPattern && (
          <div style={{ position: 'absolute', inset: 0, backgroundImage: template.heroPattern, opacity: 0.5 }} />
        )}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <EditableField
            value={currentSite.hero}
            onChange={(v) => updateSite({ hero: v })}
            as="h1"
            className="text-4xl md:text-5xl lg:text-6xl leading-tight"
            style={{ fontWeight: template.headingWeight, marginBottom: 16, letterSpacing: '-0.02em' }}
          />
          <EditableField
            value={currentSite.tagline}
            onChange={(v) => updateSite({ tagline: v })}
            as="p"
            className="text-lg md:text-xl opacity-80 max-w-2xl mx-auto"
            style={{ marginBottom: 32, lineHeight: 1.6 }}
          />
          <button style={{ ...buttonStyle, padding: '14px 36px', fontSize: 16, cursor: 'pointer', border: 'none', transition: 'transform 0.2s' }}>
            Get Started
          </button>
        </div>
      </section>

      {/* ── About Section ── */}
      {isVisible('about') && (
        <section style={{ padding: '60px 40px', maxWidth: 800, margin: '0 auto' }}>
          <EditableField
            value={currentSite.aboutTitle}
            onChange={(v) => updateSite({ aboutTitle: v })}
            as="h2"
            className="text-3xl"
            style={{ fontWeight: template.headingWeight, marginBottom: 20, ...accentStyle }}
          />
          <EditableField
            value={currentSite.aboutText}
            onChange={(v) => updateSite({ aboutText: v })}
            as="p"
            className="text-base leading-relaxed"
            style={{ lineHeight: 1.8, opacity: 0.85 }}
          />
        </section>
      )}

      {/* ── Services Section ── */}
      {isVisible('services') && (
        <section style={{ padding: '60px 40px', backgroundColor: template.cardBg }}>
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <EditableField
              value={currentSite.servicesTitle}
              onChange={(v) => updateSite({ servicesTitle: v })}
              as="h2"
              className="text-3xl text-center"
              style={{ fontWeight: template.headingWeight, marginBottom: 40, ...accentStyle }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24 }}>
              {currentSite.services.map((svc, i) => (
                <div key={i} style={{ ...cardStyle, padding: 28, transition: 'transform 0.2s' }}>
                  <h3 style={{ ...accentStyle, fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{svc.name}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.75 }}>{svc.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Gallery Section ── */}
      {isVisible('gallery') && (
        <section style={{ padding: '60px 40px', maxWidth: 1000, margin: '0 auto' }}>
          <EditableField
            value={currentSite.galleryTitle}
            onChange={(v) => updateSite({ galleryTitle: v })}
            as="h2"
            className="text-3xl text-center"
            style={{ fontWeight: template.headingWeight, marginBottom: 40, ...accentStyle }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {/* Custom images from fabric.js */}
            {customImages.map((img, idx) => (
              <div
                key={`custom-${idx}`}
                style={{
                  ...cardStyle,
                  aspectRatio: '4/3',
                  overflow: 'hidden',
                  padding: 0,
                }}
              >
                <img
                  src={img}
                  alt={`Custom image ${idx + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            ))}
            {/* Pattern 1: Concentric radiating circles */}
            <div
              className="gallery-tile-1"
              style={{
                ...cardStyle,
                aspectRatio: '4/3',
                position: 'relative',
                overflow: 'hidden',
                background: `radial-gradient(circle at 30% 40%, ${template.accent}22 0%, transparent 25%),
                             radial-gradient(circle at 60% 70%, ${template.accent}18 0%, transparent 30%),
                             radial-gradient(circle at 80% 20%, ${template.accent}25 0%, transparent 20%),
                             repeating-radial-gradient(circle at 50% 50%, ${template.accent}08 0px, ${template.accent}04 4px, transparent 8px)`,
              }}
            >
              <div style={{
                position: 'absolute', inset: 0,
                background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, ${template.accent}10 90deg, transparent 180deg, ${template.accent}06 270deg, transparent 360deg)`,
                animation: 'gallerySpin 20s linear infinite',
              }} />
            </div>
            {/* Pattern 2: Diagonal stripes & diamond mesh */}
            <div
              className="gallery-tile-2"
              style={{
                ...cardStyle,
                aspectRatio: '4/3',
                position: 'relative',
                overflow: 'hidden',
                background: `repeating-linear-gradient(45deg, ${template.accent}0a 0px, ${template.accent}0a 2px, transparent 2px, transparent 12px),
                             repeating-linear-gradient(-45deg, ${template.accent}08 0px, ${template.accent}08 2px, transparent 2px, transparent 12px),
                             linear-gradient(135deg, ${template.accent}15 0%, transparent 50%, ${template.accent}08 100%)`,
              }}
            >
              <div style={{
                position: 'absolute', inset: 0,
                background: `radial-gradient(ellipse at 70% 30%, ${template.accent}12 0%, transparent 60%)`,
              }} />
            </div>
            {/* Pattern 3: Floating geometric orbs */}
            <div
              className="gallery-tile-3"
              style={{
                ...cardStyle,
                aspectRatio: '4/3',
                position: 'relative',
                overflow: 'hidden',
                background: `linear-gradient(160deg, ${template.accent}08 0%, transparent 30%, ${template.accent}0c 70%, ${template.accent}04 100%)`,
              }}
            >
              {[
                { size: 60, x: '15%', y: '25%', delay: '0s', dur: '8s', opacity: 0.2 },
                { size: 40, x: '75%', y: '20%', delay: '2s', dur: '10s', opacity: 0.15 },
                { size: 80, x: '50%', y: '55%', delay: '4s', dur: '12s', opacity: 0.12 },
                { size: 30, x: '85%', y: '65%', delay: '1s', dur: '7s', opacity: 0.18 },
                { size: 50, x: '25%', y: '70%', delay: '3s', dur: '9s', opacity: 0.14 },
              ].map((orb, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    left: orb.x,
                    top: orb.y,
                    width: orb.size,
                    height: orb.size,
                    borderRadius: '50%',
                    background: `radial-gradient(circle at 35% 35%, ${template.accent}, ${template.accent}00)`,
                    opacity: orb.opacity,
                    animation: `galleryFloat ${orb.dur} ease-in-out ${orb.delay} infinite`,
                    filter: 'blur(8px)',
                  }}
                />
              ))}
            </div>
            {/* Pattern 4: Isometric grid & tessellation */}
            <div
              className="gallery-tile-4"
              style={{
                ...cardStyle,
                aspectRatio: '4/3',
                position: 'relative',
                overflow: 'hidden',
                background: `linear-gradient(30deg, ${template.accent}06 1px, transparent 1px) 0 0 / 20px 20px,
                             linear-gradient(-30deg, ${template.accent}06 1px, transparent 1px) 0 0 / 20px 20px,
                             linear-gradient(180deg, ${template.accent}04 0%, transparent 40%, ${template.accent}0a 100%)`,
              }}
            >
              <div style={{
                position: 'absolute',
                inset: '15% 20%',
                border: `2px solid ${template.accent}15`,
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${template.accent}10 0%, transparent 100%)`,
                animation: 'galleryPulse 4s ease-in-out infinite',
              }} />
              <div style={{
                position: 'absolute',
                inset: '35% 45% 25% 25%',
                border: `2px solid ${template.accent}12`,
                borderRadius: '10px',
                background: `linear-gradient(225deg, ${template.accent}08 0%, transparent 100%)`,
                animation: 'galleryPulse 4s ease-in-out 1.5s infinite',
              }} />
              <div style={{
                position: 'absolute',
                inset: '50% 30% 15% 40%',
                border: `2px solid ${template.accent}10`,
                borderRadius: '8px',
                background: `linear-gradient(45deg, ${template.accent}06 0%, transparent 100%)`,
                animation: 'galleryPulse 4s ease-in-out 3s infinite',
              }} />
            </div>
          </div>
        </section>
      )}

      {/* ── Contact Section ── */}
      {isVisible('contact') && (
        <section style={{ padding: '60px 40px', backgroundColor: template.cardBg }}>
          <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
            <EditableField
              value={currentSite.contactTitle}
              onChange={(v) => updateSite({ contactTitle: v })}
              as="h2"
              className="text-3xl"
              style={{ fontWeight: template.headingWeight, marginBottom: 24, ...accentStyle }}
            />
            <div style={{ fontSize: 15, lineHeight: 2, opacity: 0.8 }}>
              {currentSite.contactAddress && <div>{currentSite.contactAddress}</div>}
              {currentSite.contactPhone && <div>{currentSite.contactPhone}</div>}
              {currentSite.contactEmail && <div>{currentSite.contactEmail}</div>}
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <footer style={{ ...footerStyle, padding: '32px 40px', textAlign: 'center', fontSize: 13, opacity: 0.7 }}>
        &copy; {new Date().getFullYear()} {currentSite.business}. All rights reserved.
      </footer>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-[1200px] h-[90vh] bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header Bar ── */}
            <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4">
                <div>
                  <div className="font-semibold tracking-tight text-lg">{currentSite.name}</div>
                  <div className="text-xs text-zinc-500">Visual Editor • {currentSite.variant}</div>
                </div>
                {/* Template selector */}
                <div className="flex items-center gap-1 ml-8 bg-zinc-900 rounded-xl p-1 border border-zinc-800">
                  {Object.keys(TEMPLATES).map((t) => (
                    <button
                      key={t}
                      onClick={() => updateSite({ variant: t })}
                      className={`px-3 py-1.5 text-[10px] rounded-lg transition-all ${
                        currentSite.variant === t
                          ? 'bg-zinc-700 text-white font-medium'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewMode(previewMode === 'desktop' ? 'mobile' : 'desktop')}
                  className="px-3 py-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
                  title={previewMode === 'desktop' ? 'Mobile preview' : 'Desktop preview'}
                >
                  {previewMode === 'desktop' ? <Smartphone size={15} /> : <Monitor size={15} />}
                </button>
                <button
                  onClick={() => setShowCode(!showCode)}
                  className={`px-3 py-2 rounded-xl text-[10px] transition-colors ${
                    showCode ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Code size={14} />
                </button>
                <button
                  onClick={handleCopyHtml}
                  className={`px-3 py-2 rounded-xl text-[10px] transition-colors ${
                    copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  {copied ? 'Copied!' : 'Copy HTML'}
                </button>
                <button
                  onClick={handleGenerateFullHtml}
                  disabled={generatingHtml}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white text-[11px] font-medium hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {generatingHtml ? (
                    <><Loader2 size={13} className="animate-spin" /> Generating...</>
                  ) : (
                    <><Download size={13} /> Download Full Site</>
                  )}
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-zinc-900 text-sm hover:bg-zinc-800 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={onPublish}
                  className="px-6 py-2 rounded-xl bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-colors"
                >
                  Publish Live
                </button>
              </div>
            </div>

            {/* ── Main Content ── */}
            <div className="flex flex-1 overflow-hidden">
              {/* Preview / Code panel */}
              <div className="flex-1 overflow-y-auto bg-zinc-900/50 p-6">
                {showCode && fullHtml ? (
                  <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono bg-zinc-950 p-6 rounded-xl border border-zinc-800 max-h-full overflow-auto">
                    {fullHtml}
                  </pre>
                ) : (
                  <div
                    style={{
                      borderRadius: 12,
                      overflow: 'hidden',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    }}
                  >
                    {renderPreview()}
                  </div>
                )}
              </div>

              {/* Right panel */}
              <div className="w-72 border-l border-zinc-800 flex flex-col flex-shrink-0 bg-zinc-950">
                {/* Tabs */}
                <div className="flex border-b border-zinc-800">
                  {[
                    { id: 'content', label: 'Content' },
                    { id: 'sections', label: 'Sections' },
                    { id: 'gallery', label: 'Gallery' },
                    { id: 'theme', label: 'Theme' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex-1 py-3 text-[10px] font-medium uppercase tracking-wider transition-colors ${
                        activeTab === tab.id
                          ? 'text-white border-b-2 border-white'
                          : 'text-zinc-600 hover:text-zinc-400'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* ── Image Creator Button ── */}
                {activeTab === 'gallery' && (
                  <div className="space-y-3">
                    <button
                      onClick={() => setShowImageCreator(true)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors bg-zinc-900 hover:bg-zinc-800 border border-dashed border-zinc-700"
                    >
                      <Image size={15} className="text-zinc-400" />
                      <span className="text-xs text-zinc-400">Create Custom Image</span>
                    </button>
                    {customImages.length > 0 && (
                      <div className="text-xs text-zinc-500 px-2">
                        {customImages.length} custom image(s) created
                      </div>
                    )}
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* ── Content Tab ── */}
                  {activeTab === 'content' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Hero Headline</label>                          <input
                            id="editor-hero"
                            name="hero"
                            value={currentSite.hero}
                            onChange={(e) => updateSite({ hero: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
                          />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Tagline</label>                          <input
                            id="editor-tagline"
                            name="tagline"
                            value={currentSite.tagline}
                            onChange={(e) => updateSite({ tagline: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
                          />
                      </div>
                      {isVisible('about') && (
                        <>
                          <div>
                            <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">About Title</label>
                            <input
                              id="editor-about-title"
                              name="aboutTitle"
                              value={currentSite.aboutTitle}
                              onChange={(e) => updateSite({ aboutTitle: e.target.value })}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">About Text</label>
                            <textarea
                              id="editor-about-text"
                              name="aboutText"
                              value={currentSite.aboutText}
                              onChange={(e) => updateSite({ aboutText: e.target.value })}
                              rows={4}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-zinc-600 transition-colors resize-none"
                            />
                          </div>
                        </>
                      )}
                      {isVisible('contact') && (
                        <>
                          <div>
                            <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Address</label>                              <input
                                id="editor-contact-address"
                                name="contactAddress"
                                value={currentSite.contactAddress}
                                onChange={(e) => updateSite({ contactAddress: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
                              />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Phone</label>                              <input
                                id="editor-contact-phone"
                                name="contactPhone"
                                value={currentSite.contactPhone}
                                onChange={(e) => updateSite({ contactPhone: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
                              />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">Email</label>                              <input
                                id="editor-contact-email"
                                name="contactEmail"
                                value={currentSite.contactEmail}
                                onChange={(e) => updateSite({ contactEmail: e.target.value })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-zinc-600 transition-colors"
                              />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Gallery Tab ── */}
                  {activeTab === 'gallery' && (
                    <div className="space-y-2">
                      {customImages.map((img, idx) => (
                        <div key={idx} className="relative rounded-xl overflow-hidden border border-zinc-800">
                          <img src={img} alt={`Custom ${idx}`} className="w-full h-24 object-cover" />
                          <button
                            onClick={() => setCustomImages((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 p-1 bg-red-500/80 rounded-full text-white hover:bg-red-500"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setShowImageCreator(true)}
                        className="w-full py-3 rounded-xl border-2 border-dashed border-zinc-800 text-zinc-500 text-xs hover:border-zinc-600 hover:text-zinc-400 transition-colors"
                      >
                        + Create New Image
                      </button>
                    </div>
                  )}

                  {/* ── Sections Tab ── */}
                  {activeTab === 'sections' && (
                    <div className="space-y-2">
                      {SECTION_META.map((section) => {
                        const visible = currentSite.visibleSections.includes(section.id);
                        const Icon = section.icon;
                        return (
                          <button
                            key={section.id}
                            onClick={() => toggleSection(section.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors bg-zinc-900 hover:bg-zinc-800"
                          >
                            <Icon size={15} className="text-zinc-400" />
                            <span className="text-xs flex-1 text-left">{section.label}</span>
                            {visible ? (
                              <Eye size={14} className="text-emerald-400" />
                            ) : (
                              <EyeOff size={14} className="text-zinc-600" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Theme Tab ── */}
                  {activeTab === 'theme' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-2">Template</label>
                        <div className="flex flex-col gap-1">
                          {Object.keys(TEMPLATES).map((t) => (
                            <button
                              key={t}
                              onClick={() => updateSite({ variant: t })}
                              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs transition-all ${
                                currentSite.variant === t
                                  ? 'bg-zinc-800 text-white ring-1 ring-zinc-600'
                                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                              }`}
                            >
                              <Palette size={14} />
                              {t}
                              {currentSite.variant === t && <Check size={12} className="ml-auto text-emerald-400" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-zinc-800 pt-4">
                        <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-3">Accent Colors</label>
                        <div className="flex gap-3">
                          {['#c9a84c', '#7c3aed', '#2563eb', '#059669', '#dc2626', '#0891b2', '#d946ef'].map((color) => (
                            <button
                              key={color}
                              onClick={() => updateSite({ accentColor: color })}
                              className={`w-8 h-8 rounded-xl transition-transform hover:scale-110 ${
                                currentSite.accentColor === color ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-950' : ''
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom info */}
                <div className="p-4 border-t border-zinc-800 text-[10px] text-zinc-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Opportunity Score</span>
                    <span className="text-white font-mono">{currentSite.score}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Template</span>
                    <span className="text-zinc-400">{currentSite.variant}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {currentSite.issues.slice(0, 3).map((issue, i) => (
                      <span key={i} className="px-2 py-0.5 bg-zinc-800 rounded-full text-[9px] text-zinc-400">{issue}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Image Creator Modal */}
          <ImageCreatorModal
            open={showImageCreator}
            onClose={() => setShowImageCreator(false)}
            onSave={handleSaveCustomImage}
            accentColor={currentSite.accentColor}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
