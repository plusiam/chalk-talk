import { Button } from "@/components/ui/button";
import { Sparkles, Pencil, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-accent/20">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4 animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary text-primary-foreground mb-6">
              <Pencil className="h-10 w-10" />
            </div>
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight">
              Chalk Talk
            </h1>
            <p className="text-2xl md:text-3xl text-muted-foreground font-light">
              생각을 그리는 캔버스
            </p>
          </div>

          <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <p className="text-xl md:text-2xl text-foreground/80 font-medium">
              3초 안에 시작하는 사고 시각화
            </p>
          </div>

          <div className="animate-fade-in pt-8" style={{ animationDelay: "0.4s" }}>
            <Button
              size="lg"
              onClick={() => navigate("/canvas")}
              className="text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              지금 시작하기
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-6 pt-16 animate-fade-in" style={{ animationDelay: "0.6s" }}>
            <div className="bg-card/60 backdrop-blur-sm border border-border rounded-2xl p-8 space-y-4 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                <Pencil className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="text-xl font-semibold">개인 모드</h3>
              <p className="text-muted-foreground">
                빠르고 간단한 개인 작업. 즉시 시작하고 자유롭게 표현하세요.
              </p>
            </div>

            <div className="bg-card/60 backdrop-blur-sm border border-border rounded-2xl p-8 space-y-4 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="text-xl font-semibold">모둠 모드</h3>
              <p className="text-muted-foreground">
                모둠마다 따로 쓰는 판에서 글과 선으로 생각을 주고받아요. 학생은 선생님이 보여 준 모둠 QR로 들어옵니다.
              </p>
              <a
                href={`${import.meta.env.BASE_URL}group.html`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center font-semibold text-primary underline underline-offset-4"
              >
                모둠판 열기 →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
