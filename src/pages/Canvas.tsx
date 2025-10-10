import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Pen, Undo, Download, Home, FileDown, Settings, Save, FolderOpen, ChevronLeft, ChevronRight, Plus, Palette, Trash2 } from "lucide-react";
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

interface Page {
  id: string;
  imageData: string;
}

const Canvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState("#ffffff");
  const [penSize, setPenSize] = useState<"small" | "medium" | "large">("medium");
  const [eraserSize, setEraserSize] = useState<"small" | "medium" | "large">("medium");
  const [history, setHistory] = useState<ImageData[]>([]);
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
    const resizeCanvas = () => {
      const prevData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.fillStyle = "hsl(215, 25%, 20%)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
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
    window.addEventListener("resize", resizeCanvas);

    return () => window.removeEventListener("resize", resizeCanvas);
  }, [currentPageIndex]);

  // Touch event handlers for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev, imageData]);

    setIsDrawing(true);
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
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
    e.preventDefault();
    setIsDrawing(false);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev, imageData]);

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
    setPages((prev) => {
      const newPages = [...prev];
      newPages[currentPageIndex] = {
        ...newPages[currentPageIndex],
        imageData,
      };
      return newPages;
    });
  };

  const addNewPage = () => {
    saveCurrentPage();
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
      setCurrentPageIndex((prev) => prev - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPageIndex < pages.length - 1) {
      saveCurrentPage();
      setCurrentPageIndex((prev) => prev + 1);
    }
  };

  const undo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || history.length === 0) return;

    const previousState = history[history.length - 1];
    ctx.putImageData(previousState, 0, 0);
    setHistory((prev) => prev.slice(0, -1));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Save current state to history before clearing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev, imageData]);

    // Clear canvas
    ctx.fillStyle = "hsl(215, 25%, 20%)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

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
      pages,
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

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = generateFilename("png");
    link.href = canvas.toDataURL("image/png");
    link.click();
    
    toast({
      title: "다운로드 완료",
      description: "이미지가 저장되었습니다.",
    });
  };

  const downloadPDF = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      saveCurrentPage();
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });

      pages.forEach((page, index) => {
        if (index > 0) {
          pdf.addPage();
        }
        if (page.imageData) {
          pdf.addImage(page.imageData, "PNG", 0, 0, canvas.width, canvas.height);
        }
      });

      pdf.save(generateFilename("pdf"));
      
      toast({
        title: "다운로드 완료",
        description: `PDF가 저장되었습니다. (${pages.length}페이지)`,
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
        className="w-full h-full cursor-crosshair touch-none"
      />

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
            onClick={() => setTool("pen")}
            className="hover:bg-accent flex-shrink-0"
          >
            <Pen className="h-5 w-5" />
          </Button>

          <Button
            variant={tool === "eraser" ? "default" : "ghost"}
            size="icon"
            onClick={() => setTool("eraser")}
            className="hover:bg-accent flex-shrink-0"
          >
            <Eraser className="h-5 w-5" />
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

          <div className="w-px h-8 bg-border flex-shrink-0" />

          <div className="flex gap-2 flex-shrink-0">
            {colors.map((c) => (
              <button
                key={c.name}
                onClick={() => setColor(c.value)}
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
                  setColor(customColor);
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
