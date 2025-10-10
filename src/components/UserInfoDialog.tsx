import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Users } from "lucide-react";

interface UserInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, groupName: string) => void;
  initialName?: string;
  initialGroupName?: string;
}

const UserInfoDialog = ({
  open,
  onOpenChange,
  onSave,
  initialName = "",
  initialGroupName = "",
}: UserInfoDialogProps) => {
  const [name, setName] = useState(initialName);
  const [groupName, setGroupName] = useState(initialGroupName);

  useEffect(() => {
    setName(initialName);
    setGroupName(initialGroupName);
  }, [initialName, initialGroupName]);

  const handleSave = () => {
    // Sanitize input for filename use
    const sanitizedName = name.trim().slice(0, 50);
    const sanitizedGroupName = groupName.trim().slice(0, 50);
    
    if (!sanitizedName && !sanitizedGroupName) {
      return;
    }
    
    onSave(sanitizedName, sanitizedGroupName);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>사용자 정보</DialogTitle>
          <DialogDescription>
            다운로드할 파일에 포함될 정보를 입력하세요.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              이름
            </Label>
            <Input
              id="name"
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="groupName" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              모둠명 (선택)
            </Label>
            <Input
              id="groupName"
              placeholder="1모둠"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSave}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserInfoDialog;
