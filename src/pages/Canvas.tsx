import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { Eraser, Pen, Undo, Download, Home, FileDown, Settings, Save, FolderOpen, ChevronLeft, ChevronRight, Plus, Palette, Trash2, Type, Minus, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import { useToast } from "@/hooks/use-toast";
import UserInfoDialog from "@/components/UserInfoDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface TextItem {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
}

interface Page {
  id: string;
  imageData: string;
  texts?: TextItem[];
}

interface HistoryEntry {
  image: ImageData;
  texts: TextItem[];
}

const CANVAS_BG = "hsl(215, 25%, 20%)";
const TEXT_FONT = '"Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
const TEXT_WEIGHT = 600;
const LINE_HEIGHT = 1.25;
const TEXT_PAD = 6;
const MIN_FONT = 12;
const MAX_FONT = 400;
const MAX_HISTORY = 40;
const textSizes = { small: 28, medium: 48, large: 80 };

const clampFont = (size: number) => Math.min(MAX_FONT, Math.max(MIN_FONT, Math.round(size)));

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const drawTexts = (ctx: CanvasRenderingContext2D, items: TextItem[]) => {
  items.forEach((t) => {
    ctx.save();
    ctx.font = `${TEXT_WEIGHT} ${t.fontSize}px ${TEXT_FONT}`;
    ctx.fillStyle = t.color;
    ctx.textBaseline = "middle";
    const lineH = t.fontSize * LINE_HEIGHT;
    t.text.split("\n").forEach((line, i) => {
      ctx.fillText(line, t.x + TEXT_PAD, t.y + TEXT_PAD + lineH * (i + 0.5));
    });
    ctx.restore();
  });
};

// 펜 그림(이미지)과 글상자를 한 장의 PNG로 합친다 (다운로드·PDF용)
const composePage = async (imageData: string, items: TextItem[], width: number, height: number) => {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) return imageData;
  ctx.fillStyle = CANVAS_BG;
  ctx.fillRect(0, 0, width, height);
  const img = await loadImage(imageData);
  if (img) ctx.drawImage(img, 0, 0);
  drawTexts(ctx, items);
  return c.toDataURL("image/png");
};

const Canvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser" | "text">("pen");
  const [color, setColor] = useState("#ffffff");
  const [penSize, setPenSize] = useState<"small" | "medium" | "large">("medium");
  const [eraserSize, setEraserSize] = useState<"small" | "medium" | "large">("medium");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textSize, setTextSize] = useState<number>(textSizes.medium);
  const textsRef = useRef<TextItem[]>([]);
  textsRef.current = texts;
  const editRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragRef = useRef<{
    id: string;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origSize: number;
    anchorX: number;
    anchorY: number;
    wasSelected: boolean;
    moved: boolean;
  } | null>(null);
  const pressHadSelectionRef = useRef(false);
  const textHintShownRef = useRef(false);
  const [userName, setUserName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState("#ffffff");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedDrawings, setSavedDrawings] = useState<string[]>([]);
  const [pages, setPages] = useState<Page[]>([{ id: "1", imageData: "" }]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  const colors = [
    { name: "white", value: "#f2f2f2" },
    { name: "yellow", value: "#ffd966" },
    { name: "pink", value: "#ffb3d9" },
    { name: "blue", value: "#80d4ff" },
    { name: "green", value: "#99e699" },
    { name: "orange", value: "#ffb366" },
    { name: "red", value: "#ff6b6b" },
    { name: "purple", value: "#c084fc" },
    { name: "cyan", value: "#67e8f9" },
    { name: "lime", value: "#bef264" },
  ];

  useEffect(() => {
    // Load user info from localStorage
    const savedUserName = localStorage.getItem("chalkTalk_userName");
    const savedGroupName = localStorage.getItem("chalkTalk_groupName");
    if (savedUserName) setUserName(savedUserName);
    if (savedGroupName) setGroupName(savedGroupName);

    // Load saved drawings list
    const drawings = Object.keys(localStorage).filter(key => key.startsWith("chalkTalk_drawing_"));
    setSavedDrawings(drawings.map(key => key.replace("chalkTalk_drawing_", "")));

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = (keepCurrent = false) => {
      const prevData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.fillStyle = "hsl(215, 25%, 20%)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 창 크기가 바뀌어도(전체화면·화면 회전) 지금 그린 그림을 유지
      if (keepCurrent) {
        ctx.putImageData(prevData, 0, 0);
        return;
      }
      
      // Restore previous drawing if exists
      if (pages[currentPageIndex].imageData) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
        };
        img.src = pages[currentPageIndex].imageData;
      }
    };

    resizeCanvas();
    const onResize = () => resizeCanvas(true);
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [currentPageIndex]);

  // Touch event handlers for mobile
  // ---------- 글상자(텍스트) ----------
  const pushHistory = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const snapshotTexts = textsRef.current;
    setHistory((prev) => [...prev, { image, texts: snapshotTexts }].slice(-MAX_HISTORY));
  };

  const updateText = (id: string, patch: Partial<TextItem>) => {
    setTexts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const placeCaretAtEnd = (el: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const startEditing = (id: string) => {
    flushSync(() => {
      setSelectedTextId(id);
      setEditingTextId(id);
    });
    const el = editRefs.current[id];
    if (el) {
      el.focus();
      placeCaretAtEnd(el);
    }
  };

  const commitEdit = (id: string) => {
    const el = editRefs.current[id];
    const raw = el ? el.innerText : "";
    const value = raw.replace(/\u00a0/g, " ").replace(/\n$/, "");
    const current = textsRef.current.find((t) => t.id === id);
    if (!value.trim()) {
      setTexts((prev) => prev.filter((t) => t.id !== id));
      setSelectedTextId((prev) => (prev === id ? null : prev));
    } else if (current && current.text !== value) {
      if (current.text) pushHistory();
      updateText(id, { text: value });
    }
    setEditingTextId((prev) => (prev === id ? null : prev));
  };

  const createTextAt = (x: number, y: number) => {
    pushHistory();
    const item: TextItem = {
      id: `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      x: Math.max(0, x - TEXT_PAD),
      y: Math.max(0, y - TEXT_PAD - (textSize * LINE_HEIGHT) / 2),
      text: "",
      fontSize: textSize,
      color,
    };
    flushSync(() => {
      setTexts((prev) => [...prev, item]);
    });
    startEditing(item.id);
  };

  const deleteText = (id: string) => {
    pushHistory();
    setTexts((prev) => prev.filter((t) => t.id !== id));
    setSelectedTextId(null);
    setEditingTextId(null);
  };

  const changeTextSize = (id: string, size: number) => {
    const current = textsRef.current.find((t) => t.id === id);
    if (!current) return;
    const next = clampFont(size);
    if (next === current.fontSize) return;
    pushHistory();
    updateText(id, { fontSize: next });
  };

  const stepTextSize = (id: string, direction: 1 | -1) => {
    const current = textsRef.current.find((t) => t.id === id);
    if (!current) return;
    const step = Math.max(2, Math.round(current.fontSize * 0.15));
    changeTextSize(id, current.fontSize + direction * step);
  };

  const applyColor = (value: string) => {
    setColor(value);
    if (selectedTextId) {
      const current = textsRef.current.find((t) => t.id === selectedTextId);
      if (current && current.color !== value) {
        pushHistory();
        updateText(selectedTextId, { color: value });
      }
    }
  };

  const applyTextPreset = (size: number) => {
    setTextSize(size);
    if (selectedTextId) changeTextSize(selectedTextId, size);
  };

  const selectTool = (next: "pen" | "eraser" | "text") => {
    if (editingTextId) (document.activeElement as HTMLElement | null)?.blur();
    setSelectedTextId(null);
    setTool(next);
    if (next === "text" && !textHintShownRef.current) {
      textHintShownRef.current = true;
      toast({
        title: "글자 쓰기",
        description: "빈 곳을 누르면 글상자가 생겨요. 글자를 끌어 옮기고, 오른쪽 아래 동그라미를 끌거나 A+ / A− 로 크기를 바꿔요. 한 번 더 누르면 고칠 수 있어요.",
      });
    }
  };

  const onTextPointerDown = (e: React.PointerEvent<HTMLDivElement>, t: TextItem) => {
    if (tool !== "text") return;
    if (editingTextId === t.id) return; // 글자 고치는 중에는 커서 이동을 허용
    e.stopPropagation();
    dragRef.current = {
      id: t.id,
      mode: "move",
      startX: e.clientX,
      startY: e.clientY,
      origX: t.x,
      origY: t.y,
      origSize: t.fontSize,
      anchorX: 0,
      anchorY: 0,
      wasSelected: selectedTextId === t.id,
      moved: false,
    };
    setSelectedTextId(t.id);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>, t: TextItem) => {
    e.stopPropagation();
    e.preventDefault();
    const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    dragRef.current = {
      id: t.id,
      mode: "resize",
      startX: e.clientX,
      startY: e.clientY,
      origX: t.x,
      origY: t.y,
      origSize: t.fontSize,
      anchorX: box.left,
      anchorY: box.top,
      wasSelected: true,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onDragPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 4) return;
      d.moved = true;
      pushHistory();
    }
    if (d.mode === "move") {
      updateText(d.id, { x: d.origX + dx, y: d.origY + dy });
    } else {
      const startDist = Math.max(10, Math.hypot(d.startX - d.anchorX, d.startY - d.anchorY));
      const dist = Math.hypot(e.clientX - d.anchorX, e.clientY - d.anchorY);
      updateText(d.id, { fontSize: clampFont(d.origSize * (dist / startDist)) });
    }
  };

  const onDragPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.mode === "move" && !d.moved && d.wasSelected) {
      startEditing(d.id);
    }
  };

  const handleCanvasPointerDown = () => {
    pressHadSelectionRef.current = !!(selectedTextId || editingTextId);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== "text") return;
    if (pressHadSelectionRef.current) {
      // 첫 번째 누름은 선택 해제만
      setSelectedTextId(null);
      pressHadSelectionRef.current = false;
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    createTextAt(e.clientX - rect.left, e.clientY - rect.top);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedTextId || editingTextId) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA"].includes(target.tagName))) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteText(selectedTextId);
      } else if (e.key === "Enter") {
        e.preventDefault();
        startEditing(selectedTextId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- 펜·지우개 ----------
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (tool === "text") return; // 글자 도구는 click 이벤트로 처리 (모바일 키보드가 뜨도록)
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    pushHistory();

    setIsDrawing(true);
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (tool === "text") return;
    e.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const penSizes = { small: 2, medium: 5, large: 10 };
    const eraserSizes = { small: 10, medium: 20, large: 40 };
    ctx.lineWidth = tool === "eraser" ? eraserSizes[eraserSize] : penSizes[penSize];
    ctx.lineCap = "round";
    ctx.strokeStyle = tool === "eraser" ? "hsl(215, 25%, 20%)" : color;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (tool === "text") return;
    e.preventDefault();
    if (isDrawing) saveCurrentPage();
    setIsDrawing(false);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "text") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    pushHistory();

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const penSizes = { small: 2, medium: 5, large: 10 };
    const eraserSizes = { small: 10, medium: 20, large: 40 };
    ctx.lineWidth = tool === "eraser" ? eraserSizes[eraserSize] : penSizes[penSize];
    ctx.lineCap = "round";
    ctx.strokeStyle = tool === "eraser" ? "hsl(215, 25%, 20%)" : color;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    saveCurrentPage();
  };

  const saveCurrentPage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageData = canvas.toDataURL("image/png");
    const pageTexts = textsRef.current;
    setPages((prev) => {
      const newPages = [...prev];
      newPages[currentPageIndex] = {
        ...newPages[currentPageIndex],
        imageData,
        texts: pageTexts,
      };
      return newPages;
    });
  };

  // 현재 페이지의 최신 그림·글자까지 반영한 전체 페이지 목록
  const getPagesSnapshot = (): Page[] => {
    const canvas = canvasRef.current;
    return pages.map((p, i) =>
      i === currentPageIndex && canvas
        ? { ...p, imageData: canvas.toDataURL("image/png"), texts: textsRef.current }
        : p
    );
  };

  const resetTextUI = () => {
    setSelectedTextId(null);
    setEditingTextId(null);
    setHistory([]);
  };

  const addNewPage = () => {
    saveCurrentPage();
    setTexts([]);
    resetTextUI();
    const newPage: Page = {
      id: Date.now().toString(),
      imageData: "",
    };
    setPages((prev) => [...prev, newPage]);
    setCurrentPageIndex(pages.length);
    toast({
      title: "새 페이지 추가",
      description: `페이지 ${pages.length + 1}이(가) 추가되었습니다.`,
    });
  };

  const goToPreviousPage = () => {
    if (currentPageIndex > 0) {
      saveCurrentPage();
      setTexts(pages[currentPageIndex - 1].texts ?? []);
      resetTextUI();
      setCurrentPageIndex((prev) => prev - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPageIndex < pages.length - 1) {
      saveCurrentPage();
      setTexts(pages[currentPageIndex + 1].texts ?? []);
      resetTextUI();
      setCurrentPageIndex((prev) => prev + 1);
    }
  };

  const undo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || history.length === 0) return;

    const previousState = history[history.length - 1];
    ctx.putImageData(previousState.image, 0, 0);
    setTexts(previousState.texts);
    setSelectedTextId(null);
    setEditingTextId(null);
    setHistory((prev) => prev.slice(0, -1));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Save current state to history before clearing
    pushHistory();

    // Clear canvas (그림과 글자 모두)
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setTexts([]);
    setSelectedTextId(null);
    setEditingTextId(null);

    toast({
      title: "캔버스 지우기",
      description: "현재 페이지가 모두 지워졌습니다.",
    });
  };

  const saveDrawing = () => {
    if (!saveName.trim()) {
      toast({
        title: "오류",
        description: "저장할 이름을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    saveCurrentPage();
    const drawingData = {
      pages: getPagesSnapshot(),
      timestamp: new Date().toISOString(),
      userName,
      groupName,
    };

    localStorage.setItem(`chalkTalk_drawing_${saveName}`, JSON.stringify(drawingData));
    setSavedDrawings((prev) => [...prev.filter(d => d !== saveName), saveName]);
    setShowSaveDialog(false);
    setSaveName("");
    toast({
      title: "저장 완료",
      description: `"${saveName}"이(가) 저장되었습니다.`,
    });
  };

  const loadDrawing = (name: string) => {
    const data = localStorage.getItem(`chalkTalk_drawing_${name}`);
    if (!data) return;

    try {
      const drawingData = JSON.parse(data);
      setPages(drawingData.pages);
      setTexts(drawingData.pages[0]?.texts ?? []);
      resetTextUI();
      setCurrentPageIndex(0);
      setShowLoadDialog(false);
      toast({
        title: "불러오기 완료",
        description: `"${name}"을(를) 불러왔습니다.`,
      });

      // Load first page
      setTimeout(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        if (drawingData.pages[0].imageData) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "hsl(215, 25%, 20%)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
          };
          img.src = drawingData.pages[0].imageData;
        }
      }, 100);
    } catch (error) {
      toast({
        title: "오류",
        description: "그림을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const deleteDrawing = (name: string) => {
    localStorage.removeItem(`chalkTalk_drawing_${name}`);
    setSavedDrawings((prev) => prev.filter(d => d !== name));
    toast({
      title: "삭제 완료",
      description: `"${name}"이(가) 삭제되었습니다.`,
    });
  };

  const sanitizeFilename = (text: string): string => {
    return text.replace(/[^a-zA-Z0-9가-힣_-]/g, "_");
  };

  const generateFilename = (extension: string): string => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const parts = [];
    
    if (userName) parts.push(sanitizeFilename(userName));
    if (groupName) parts.push(sanitizeFilename(groupName));
    parts.push(timestamp);
    
    return `chalk-talk_${parts.join("_")}.${extension}`;
  };

  const handleUserInfoSave = (name: string, group: string) => {
    setUserName(name);
    setGroupName(group);
    localStorage.setItem("chalkTalk_userName", name);
    localStorage.setItem("chalkTalk_groupName", group);
    toast({
      title: "저장 완료",
      description: "사용자 정보가 저장되었습니다.",
    });
  };

  const downloadImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const merged = await composePage(canvas.toDataURL("image/png"), textsRef.current, canvas.width, canvas.height);
    const link = document.createElement("a");
    link.download = generateFilename("png");
    link.href = merged;
    link.click();
    
    toast({
      title: "다운로드 완료",
      description: "이미지가 저장되었습니다.",
    });
  };

  const downloadPDF = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      saveCurrentPage();
      const allPages = getPagesSnapshot();
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });

      for (let index = 0; index < allPages.length; index++) {
        const page = allPages[index];
        if (index > 0) {
          pdf.addPage();
        }
        const merged = await composePage(page.imageData, page.texts ?? [], canvas.width, canvas.height);
        pdf.addImage(merged, "PNG", 0, 0, canvas.width, canvas.height);
      }

      pdf.save(generateFilename("pdf"));
      
      toast({
        title: "다운로드 완료",
        description: `PDF가 저장되었습니다. (${allPages.length}페이지)`,
      });
    } catch (error) {
      toast({
        title: "오류",
        description: "PDF 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-canvas-bg">
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerDown={handleCanvasPointerDown}
        onClick={handleCanvasClick}
        className={`w-full h-full touch-none ${tool === "text" ? "cursor-text" : "cursor-crosshair"}`}
      />

      {/* 글상자 레이어 */}
      <div className="fixed inset-0 pointer-events-none">
        {texts.map((t) => {
          const isSelected = selectedTextId === t.id && tool === "text";
          const isEditing = editingTextId === t.id;
          const toolbarBelow = t.y < 70;
          const textStyle: React.CSSProperties = {
            fontSize: t.fontSize,
            color: t.color,
            fontFamily: TEXT_FONT,
            fontWeight: TEXT_WEIGHT,
            lineHeight: LINE_HEIGHT,
            whiteSpace: "pre",
            padding: TEXT_PAD,
            borderRadius: 8,
          };
          return (
            <div
              key={t.id}
              className={`absolute ${tool === "text" ? "pointer-events-auto" : "pointer-events-none"}`}
              style={{ left: t.x, top: t.y, touchAction: "none" }}
              onPointerDown={(e) => onTextPointerDown(e, t)}
              onPointerMove={onDragPointerMove}
              onPointerUp={onDragPointerUp}
              onPointerCancel={onDragPointerUp}
              onDoubleClick={() => tool === "text" && startEditing(t.id)}
            >
              {isEditing ? (
                <div
                  key="edit"
                  ref={(el) => {
                    editRefs.current[t.id] = el;
                    if (el && !el.dataset.init) {
                      el.innerText = t.text;
                      el.dataset.init = "1";
                    }
                  }}
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={() => commitEdit(t.id)}
                  onPaste={(e) => {
                    // 서식 없이 글자만 붙여넣기
                    e.preventDefault();
                    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Escape") {
                      e.preventDefault();
                      (e.currentTarget as HTMLElement).blur();
                    }
                  }}
                  style={{
                    ...textStyle,
                    minWidth: "1.5em",
                    minHeight: `${LINE_HEIGHT}em`,
                    outline: "2px solid #38bdf8",
                    background: "rgba(0,0,0,0.25)",
                    cursor: "text",
                  }}
                />
              ) : (
                <div
                  key="view"
                  style={{
                    ...textStyle,
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    cursor: tool === "text" ? "move" : "default",
                    outline: isSelected ? "2px dashed #7dd3fc" : "none",
                  }}
                >
                  {t.text}
                </div>
              )}

              {isSelected && (
                <>
                  {/* 크기 조절 손잡이 */}
                  {!isEditing && (
                    <div
                      title="끌어서 글자 크기 바꾸기"
                      className="absolute -right-3 -bottom-3 w-6 h-6 rounded-full bg-sky-400 border-2 border-white shadow cursor-nwse-resize"
                      style={{ touchAction: "none" }}
                      onPointerDown={(e) => onResizePointerDown(e, t)}
                      onPointerMove={onDragPointerMove}
                      onPointerUp={onDragPointerUp}
                      onPointerCancel={onDragPointerUp}
                    />
                  )}
                  {/* 글상자 도구 */}
                  <div
                    className={`absolute left-0 ${toolbarBelow ? "top-full mt-3" : "bottom-full mb-3"} flex items-center gap-1 whitespace-nowrap bg-card/95 border border-border rounded-xl shadow-lg p-1`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <Button variant="ghost" size="sm" className="h-8 px-2" title="글자 작게" onClick={() => stepTextSize(t.id, -1)}>
                      <Minus className="h-4 w-4" />A
                    </Button>
                    <span className="text-xs text-muted-foreground w-10 text-center">{t.fontSize}</span>
                    <Button variant="ghost" size="sm" className="h-8 px-2" title="글자 크게" onClick={() => stepTextSize(t.id, 1)}>
                      <Plus className="h-4 w-4" />A
                    </Button>
                    <div className="w-px h-6 bg-border" />
                    {!isEditing && (
                      <Button variant="ghost" size="sm" className="h-8 px-2" title="글자 고치기" onClick={() => startEditing(t.id)}>
                        <Pencil className="h-4 w-4 mr-1" />고치기
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-destructive hover:bg-destructive/10"
                      title="글상자 지우기"
                      onClick={() => deleteText(t.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />지우기
                    </Button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-10 max-w-[95vw] overflow-x-auto">
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-2xl shadow-lg p-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="hover:bg-accent flex-shrink-0"
          >
            <Home className="h-5 w-5" />
          </Button>

          <div className="w-px h-8 bg-border flex-shrink-0" />

          <Button
            variant={tool === "pen" ? "default" : "ghost"}
            size="icon"
            onClick={() => selectTool("pen")}
            className="hover:bg-accent flex-shrink-0"
            title="펜"
          >
            <Pen className="h-5 w-5" />
          </Button>

          <Button
            variant={tool === "eraser" ? "default" : "ghost"}
            size="icon"
            onClick={() => selectTool("eraser")}
            className="hover:bg-accent flex-shrink-0"
            title="지우개"
          >
            <Eraser className="h-5 w-5" />
          </Button>

          <Button
            variant={tool === "text" ? "default" : "ghost"}
            size="icon"
            onClick={() => selectTool("text")}
            className="hover:bg-accent flex-shrink-0"
            title="글자 쓰기"
          >
            <Type className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={clearCanvas}
            className="hover:bg-accent hover:bg-destructive/10 flex-shrink-0"
            title="전체 지우기"
          >
            <Trash2 className="h-5 w-5" />
          </Button>

          <div className="w-px h-8 bg-border flex-shrink-0" />

          {/* Size selector */}
          {tool === "text" ? (
          <div className="flex gap-1 items-center flex-shrink-0">
            <span className="text-xs text-muted-foreground mr-1">글자</span>
            {([
              ["small", "작게"],
              ["medium", "중간"],
              ["large", "크게"],
            ] as const).map(([key, label]) => (
              <Button
                key={key}
                variant={textSize === textSizes[key] ? "default" : "ghost"}
                size="sm"
                onClick={() => applyTextPreset(textSizes[key])}
                className="h-8 px-2 text-xs"
              >
                {label}
              </Button>
            ))}
          </div>
          ) : (
          <div className="flex gap-1 items-center flex-shrink-0">
            <span className="text-xs text-muted-foreground mr-1">
              {tool === "pen" ? "펜" : "지우개"}
            </span>
            <Button
              variant={tool === "pen" && penSize === "small" || tool === "eraser" && eraserSize === "small" ? "default" : "ghost"}
              size="sm"
              onClick={() => tool === "pen" ? setPenSize("small") : setEraserSize("small")}
              className="h-8 px-2 text-xs"
            >
              작게
            </Button>
            <Button
              variant={tool === "pen" && penSize === "medium" || tool === "eraser" && eraserSize === "medium" ? "default" : "ghost"}
              size="sm"
              onClick={() => tool === "pen" ? setPenSize("medium") : setEraserSize("medium")}
              className="h-8 px-2 text-xs"
            >
              중간
            </Button>
            <Button
              variant={tool === "pen" && penSize === "large" || tool === "eraser" && eraserSize === "large" ? "default" : "ghost"}
              size="sm"
              onClick={() => tool === "pen" ? setPenSize("large") : setEraserSize("large")}
              className="h-8 px-2 text-xs"
            >
              크게
            </Button>
          </div>
          )}

          <div className="w-px h-8 bg-border flex-shrink-0" />

          <div className="flex gap-2 flex-shrink-0">
            {colors.map((c) => (
              <button
                key={c.name}
                onClick={() => applyColor(c.value)}
                className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                  color === c.value ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowColorPicker(true)}
              className="hover:bg-accent"
              title="사용자 정의 색상"
            >
              <Palette className="h-5 w-5" />
            </Button>
          </div>

          <div className="w-px h-8 bg-border flex-shrink-0" />

          <Button
            variant="ghost"
            size="icon"
            onClick={undo}
            disabled={history.length === 0}
            className="hover:bg-accent flex-shrink-0"
          >
            <Undo className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSaveDialog(true)}
            className="hover:bg-accent flex-shrink-0"
            title="저장하기"
          >
            <Save className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowLoadDialog(true)}
            className="hover:bg-accent flex-shrink-0"
            title="불러오기"
          >
            <FolderOpen className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-accent flex-shrink-0">
                <Download className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={downloadImage}>
                <FileDown className="mr-2 h-4 w-4" />
                이미지 (PNG)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadPDF}>
                <FileDown className="mr-2 h-4 w-4" />
                PDF ({pages.length}페이지)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowUserDialog(true)}
            className="hover:bg-accent flex-shrink-0"
            title="사용자 정보"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Page Navigation */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-2xl shadow-lg p-2 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPreviousPage}
            disabled={currentPageIndex === 0}
            className="hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-sm px-3">
            페이지 {currentPageIndex + 1} / {pages.length}
          </span>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextPage}
            disabled={currentPageIndex === pages.length - 1}
            className="hover:bg-accent"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border" />

          <Button
            variant="ghost"
            size="sm"
            onClick={addNewPage}
            className="hover:bg-accent"
          >
            <Plus className="h-4 w-4 mr-1" />
            새 페이지
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      <UserInfoDialog
        open={showUserDialog}
        onOpenChange={setShowUserDialog}
        onSave={handleUserInfoSave}
        initialName={userName}
        initialGroupName={groupName}
      />

      {/* Color Picker Dialog */}
      <Dialog open={showColorPicker} onOpenChange={setShowColorPicker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>사용자 정의 색상</DialogTitle>
            <DialogDescription>
              원하는 색상을 선택하세요
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="w-full h-32 rounded cursor-pointer"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  applyColor(customColor);
                  setShowColorPicker(false);
                  toast({
                    title: "색상 적용",
                    description: "사용자 정의 색상이 적용되었습니다.",
                  });
                }}
                className="flex-1"
              >
                적용
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowColorPicker(false)}
                className="flex-1"
              >
                취소
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>그림 저장하기</DialogTitle>
            <DialogDescription>
              나중에 불러올 수 있도록 이름을 입력하세요
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Input
              placeholder="저장할 이름을 입력하세요"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  saveDrawing();
                }
              }}
            />
            <div className="flex gap-2">
              <Button onClick={saveDrawing} className="flex-1">
                저장
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowSaveDialog(false);
                  setSaveName("");
                }}
                className="flex-1"
              >
                취소
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Load Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>저장된 그림 불러오기</DialogTitle>
            <DialogDescription>
              불러올 그림을 선택하세요
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
            {savedDrawings.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                저장된 그림이 없습니다
              </p>
            ) : (
              savedDrawings.map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                >
                  <span className="font-medium">{name}</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => loadDrawing(name)}
                    >
                      불러오기
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteDrawing(name)}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Canvas;
