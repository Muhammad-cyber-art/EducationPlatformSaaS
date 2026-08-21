import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { get_user_info } from "../Authorized/getRole";
import { useCurrentBranch } from "../Authorized/useBranchId";
import api from "../../tokenUpdater/updater";
import toast from "react-hot-toast";
import { safeArray } from "../../utils/safeArray";

export const useAddStudent = (branchId) => {
  const { currentBranchId } = useCurrentBranch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams();
  const paramGroupId = Number(params.group_id);
  const hasGroupId = !isNaN(paramGroupId) && paramGroupId > 0;

  const [formData, setFormData] = useState({
    group: hasGroupId ? paramGroupId : "",
    full_name: "",
    phone: "",
    birth_date: "",
    parent_name: "",
    parent_phone: "",
    address: "",
    notes: "",
    image: null,
    status: "regular",
    custom_fee: "",
    branch_id: currentBranchId || branchId,
    create_payment: true,
  });

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [groups, setGroups] = useState([]);
  const [enrollmentToggles, setEnrollmentToggles] = useState({});

  const user_info = get_user_info();

  const { data: userData = {} } = useQuery({
    queryKey: ["user-me"],
    queryFn: () => api.get("/user/me/").then((res) => res.data),
    staleTime: Infinity,
  });

  const perms = userData.permissions || {};
  const isSuperAdmin = user_info?.role === "super_admin";

  useEffect(() => {
    if (userData.id && perms.students === false && !isSuperAdmin) {
      toast.error("Sizda o'quvchi qo'shish ruxsati yo'q!");
      navigate(-1);
    }
  }, [userData.id, perms.students, isSuperAdmin, navigate]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      branch_id: currentBranchId || branchId,
    }));
  }, [currentBranchId, branchId]);

  useEffect(() => {
    if (!hasGroupId && (currentBranchId || branchId)) {
      api
        .get(`/groups/nested_groups/`)
        .then((res) => setGroups(safeArray(res.data)))
        .catch((err) => console.error("Error loading groups", err));
    }
  }, [hasGroupId, currentBranchId, branchId]);

  // Debounced search logic
  useEffect(() => {
    const searchTrigger = async () => {
      const { phone, full_name } = formData;
      const cleanPhone = phone.replace(/\D/g, "");

      if (cleanPhone.length >= 7 || full_name.trim().length >= 3) {
        const query = cleanPhone.length >= 7 ? phone : full_name;
        setSearching(true);
        try {
          const response = await api.get(
            `/groups/students/?search=${encodeURIComponent(query)}`,
          );
          setSearchResults(safeArray(response.data));
        } catch (error) {
          console.error("Qidiruvda xatolik:", error);
        } finally {
          setSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    };

    const timer = setTimeout(() => {
      searchTrigger();
    }, 600);

    return () => clearTimeout(timer);
  }, [formData.phone, formData.full_name]);

  useEffect(() => {
    const newToggles = { ...enrollmentToggles };
    searchResults.forEach((st) => {
      if (newToggles[st.id] === undefined) newToggles[st.id] = true;
    });
    setEnrollmentToggles(newToggles);
  }, [searchResults]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const newState = { ...prev, [name]: value };
      if (name === "status" && value !== "teacher_negotiated") {
        newState.include_in_mentor_salary = true;
      }
      return newState;
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({ ...prev, image: file }));
      setPreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setFormData((prev) => ({ ...prev, image: null }));
    setPreview(null);
  };

  const handleEnrollExisting = async (studentId) => {
    if (!hasGroupId && !formData.group) return toast.error("Guruhni tanlang!");
    const groupId = hasGroupId ? paramGroupId : formData.group;
    const shouldCreatePayment = enrollmentToggles[studentId] !== false;

    setLoading(true);
    try {
      const response = await api.post(
        `/groups/groups/${groupId}/enroll-student/`,
        {
          student_id: studentId,
          create_payment: shouldCreatePayment,
        },
      );
      if (response.status === 201 || response.status === 200) {
        toast.success("O'quvchi guruhga biriktirildi!");
        queryClient.removeQueries({
          queryKey: ["group-detail", String(groupId)],
        });
        queryClient.removeQueries({ queryKey: ["group-detail", groupId] });
        navigate(-1);
      } else {
        toast.error(response.data?.detail || "Noma'lum xatolik");
      }
    } catch (error) {
      const errMsg =
        error.response?.data?.detail || "Biriktirishda xatolik yuz berdi";
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.group && !hasGroupId) return toast.error("Guruhni tanlang!");
    if (!formData.full_name?.trim())
      return toast.error("Ism-familiyani kiriting!");

    setLoading(true);
    const data = new FormData();

    Object.keys(formData).forEach((key) => {
      const val = formData[key];

      // Rasm alohida
      if (key === "image") {
        if (val instanceof File) data.append("image", val);
        return;
      }

      // Boolean maydonlar: "true"/"false" sifatida yuborish
      if (typeof val === "boolean") {
        data.append(key, String(val));
        return;
      }

      // Bo'sh string, null, undefined — yubormaymiz
      // (birth_date, custom_fee, address kabi ixtiyoriy maydonlar)
      if (val === null || val === undefined || val === "") return;

      data.append(key, val);
    });

    // group_id dan olayotgan bo'lsak, uni ham qo'shamiz
    if (hasGroupId && !formData.group) {
      data.append("group", paramGroupId);
    }

    try {
      const response = await api.post("/groups/students/", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (response.status === 201 || response.status === 200) {
        toast.success("O'quvchi muvaffaqiyatli qo'shildi!");
        if (paramGroupId) {
          queryClient.removeQueries({
            queryKey: ["group-detail", String(paramGroupId)],
          });
          queryClient.removeQueries({
            queryKey: ["group-detail", paramGroupId],
          });
        }
        navigate(-1);
      }
    } catch (err) {
      console.error("Student qo'shishda xato:", err);
      const data = err?.response?.data;
      const errMsg =
        data?.detail ||
        data?.non_field_errors?.[0] ||
        data?.full_name?.[0] ||
        data?.phone?.[0] ||
        data?.group?.[0] ||
        data?.branch_id?.[0] ||
        (typeof data === "string" ? data : null) ||
        (data ? JSON.stringify(data) : null) ||
        "O'quvchi qo'shishda xatolik yuz berdi";
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    setFormData,
    preview,
    loading,
    searchResults,
    searching,
    groups,
    enrollmentToggles,
    setEnrollmentToggles,
    hasGroupId,
    paramGroupId,
    handleChange,
    handleImageChange,
    removeImage,
    handleEnrollExisting,
    handleSubmit,
    navigate,
  };
};
