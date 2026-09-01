from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from app.models import SmsProviderConfig
from app.permissions import HasAdminPage
from app.services.sms_service import SmsProviderService


class AdminSmsCatalogView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "settings"

    def get(self, request):
        return Response(SmsProviderService.catalog())


class AdminSmsProviderListView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "settings"

    def get(self, request):
        return Response(SmsProviderService.list_rows())

    def post(self, request):
        data = request.data
        if hasattr(data, "dict"):
            data = data.dict()
        cfg, err = SmsProviderService.create(data)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SmsProviderService.serialize(cfg), status=status.HTTP_201_CREATED)


class AdminSmsProviderDetailView(APIView):
    permission_classes = [HasAdminPage]
    required_admin_page = "settings"

    def _get(self, pk):
        return SmsProviderConfig.objects.get(pk=pk)

    def get(self, request, pk):
        try:
            cfg = self._get(pk)
        except SmsProviderConfig.DoesNotExist:
            return Response({"detail": "یافت نشد"}, status=404)
        return Response(SmsProviderService.serialize(cfg))

    def patch(self, request, pk):
        try:
            cfg = self._get(pk)
        except SmsProviderConfig.DoesNotExist:
            return Response({"detail": "یافت نشد"}, status=404)
        data = request.data
        if hasattr(data, "dict"):
            data = data.dict()
        cfg, err = SmsProviderService.update(cfg, data)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SmsProviderService.serialize(cfg))

    def delete(self, request, pk):
        try:
            cfg = self._get(pk)
        except SmsProviderConfig.DoesNotExist:
            return Response({"detail": "یافت نشد"}, status=404)
        SmsProviderService.delete(cfg)
        return Response(status=status.HTTP_204_NO_CONTENT)
