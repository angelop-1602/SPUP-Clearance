"use client";

import React, { useState, useEffect } from 'react';
import { Student } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateSubmissionDetails } from '@/services/firebase';
import { toast } from 'sonner';

interface EditSubmissionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  submission: Student | null;
  onUpdate: () => void;
}

export function EditSubmissionDialog({
  isOpen,
  onOpenChange,
  submission,
  onUpdate
}: EditSubmissionDialogProps) {
  const [formData, setFormData] = useState<Partial<Student>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (submission) {
      setFormData({
        name: submission.name,
        email: submission.email,
        studentId: submission.studentId,
        adviser: submission.adviser,
        course: submission.course,
        researchTitle: submission.researchTitle,
        researchType: submission.researchType,
        level: submission.level,
        groupMembers: submission.groupMembers || []
      });
    }
  }, [submission]);

  const handleSave = async () => {
    if (!submission) return;

    setIsLoading(true);
    try {
      await updateSubmissionDetails(submission.id, formData);
      toast.success('Submission updated successfully');
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating submission:', error);
      toast.error('Failed to update submission');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addGroupMember = () => {
    setFormData(prev => ({
      ...prev,
      groupMembers: [...(prev.groupMembers || []), { name: '', studentID: '' }]
    }));
  };

  const updateGroupMember = (index: number, field: 'name' | 'studentID', value: string) => {
    setFormData(prev => ({
      ...prev,
      groupMembers: prev.groupMembers?.map((member, i) => 
        i === index ? { ...member, [field]: value } : member
      ) || []
    }));
  };

  const removeGroupMember = (index: number) => {
    setFormData(prev => ({
      ...prev,
      groupMembers: prev.groupMembers?.filter((_, i) => i !== index) || []
    }));
  };

  if (!submission) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Submission</DialogTitle>
          <DialogDescription>
            Make changes to the submission details below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Student Name</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="studentId">Student ID</Label>
              <Input
                id="studentId"
                value={formData.studentId || ''}
                onChange={(e) => handleInputChange('studentId', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course">Course</Label>
              <Input
                id="course"
                value={formData.course || ''}
                onChange={(e) => handleInputChange('course', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="adviser">Adviser</Label>
              <Input
                id="adviser"
                value={formData.adviser || ''}
                onChange={(e) => handleInputChange('adviser', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="level">Level</Label>
              <Select value={formData.level || ''} onValueChange={(value) => handleInputChange('level', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="undergrad">Undergraduate</SelectItem>
                  <SelectItem value="grad">Graduate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="researchType">Research Type</Label>
            <Select value={formData.researchType || ''} onValueChange={(value) => handleInputChange('researchType', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select research type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Thesis">Thesis</SelectItem>
                <SelectItem value="Capstone">Capstone</SelectItem>
                <SelectItem value="Dissertation">Dissertation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="researchTitle">Research Title</Label>
            <Input
              id="researchTitle"
              value={formData.researchTitle || ''}
              onChange={(e) => handleInputChange('researchTitle', e.target.value)}
            />
          </div>

          {/* Group Members (for undergraduate) */}
          {formData.level === 'undergrad' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Group Members</Label>
                <Button type="button" variant="outline" size="sm" onClick={addGroupMember}>
                  Add Member
                </Button>
              </div>
              {formData.groupMembers?.map((member, index) => (
                <div key={index} className="grid grid-cols-5 gap-2 items-end">
                  <div className="col-span-2">
                    <Input
                      placeholder="Member name"
                      value={member.name}
                      onChange={(e) => updateGroupMember(index, 'name', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      placeholder="Student ID"
                      value={member.studentID}
                      onChange={(e) => updateGroupMember(index, 'studentID', e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeGroupMember(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
