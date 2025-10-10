import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Pen, Undo, Download, Home, FileDown, Settings } from "lucide-react";
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

const Canvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState("#ffffff");
  const [history, setHistory] = useState<ImageData[]>([]);
  const [userName, setUserName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [showUserDialog, setShowUserDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const colors = [
    { name: "white", value: "#f2f2f2" },
    { name: "yellow", value: "#ffd966" },
    { name: "pink", value: "#ffb3d9" },
    { name: "blue", value: "#80d4ff" },
    { name: "green", value: "#99e699" },
    { name: "orange", value: "#ffb366" },
  ];

  useEffect(() => {
    // Load user info from localStorage
    const savedUserName = localStorage.getItem("chalkTalk_userName");
    const savedGroupName = localStorage.getItem("chalkTalk_groupName");
    if (savedUserName) setUserName(savedUserName);
    if (savedGroupName) setGroupName(savedGroupName);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx.fillStyle = "hsl(215, 25%, 20%)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Save current state to history
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

    ctx.lineWidth = tool === "eraser" ? 20 : 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = tool === "eraser" ? "hsl(215, 25%, 20%)" : color;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const undo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || history.length === 0) return;

    const previousState = history[history.length - 1];
    ctx.putImageData(previousState, 0, 0);
    setHistory((prev) => prev.slice(0, -1));
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
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(generateFilename("pdf"));
      
      toast({
        title: "다운로드 완료",
        description: "PDF가 저장되었습니다.",
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
        className="w-full h-full cursor-crosshair"
      />

      {/* Toolbar */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-2xl shadow-lg p-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="hover:bg-accent"
          >
            <Home className="h-5 w-5" />
          </Button>

          <div className="w-px h-8 bg-border" />

          <Button
            variant={tool === "pen" ? "default" : "ghost"}
            size="icon"
            onClick={() => setTool("pen")}
            className="hover:bg-accent"
          >
            <Pen className="h-5 w-5" />
          </Button>

          <Button
            variant={tool === "eraser" ? "default" : "ghost"}
            size="icon"
            onClick={() => setTool("eraser")}
            className="hover:bg-accent"
          >
            <Eraser className="h-5 w-5" />
          </Button>

          <div className="w-px h-8 bg-border" />

          <div className="flex gap-2">
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
          </div>

          <div className="w-px h-8 bg-border" />

          <Button
            variant="ghost"
            size="icon"
            onClick={undo}
            disabled={history.length === 0}
            className="hover:bg-accent"
          >
            <Undo className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-accent">
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
                PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowUserDialog(true)}
            className="hover:bg-accent"
            title="사용자 정보"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <UserInfoDialog
        open={showUserDialog}
        onOpenChange={setShowUserDialog}
        onSave={handleUserInfoSave}
        initialName={userName}
        initialGroupName={groupName}
      />
    </div>
  );
};

export default Canvas;
